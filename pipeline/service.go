package pipeline

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
)

// StepResult represents the JSON output from a pipeline Python script.
type StepResult struct {
	Status  string `json:"status"`
	Step    string `json:"step,omitempty"`
	Message string `json:"message,omitempty"`
	Output  string `json:"output,omitempty"`
	Error   string `json:"error,omitempty"`
}

// ProgressCallback is called with pipeline step progress updates.
type ProgressCallback func(step, message string)

// Service orchestrates the Python ML pipeline scripts for character creation.
type Service struct {
	pipelineDir string // Directory containing the Python scripts
	pythonCmd   string // Python executable path
	mu          sync.Mutex
}

// NewService creates a new pipeline service.
// pipelineDir should point to the directory containing the Python scripts.
func NewService(pipelineDir string) *Service {
	return &Service{
		pipelineDir: pipelineDir,
		pythonCmd:   findPython(),
	}
}

// findPython locates the Python 3 executable.
func findPython() string {
	candidates := []string{"python3", "python"}
	for _, cmd := range candidates {
		if path, err := exec.LookPath(cmd); err == nil {
			return path
		}
	}
	return "python3" // fallback
}

// IsPythonAvailable checks if Python 3 is installed and accessible.
func (s *Service) IsPythonAvailable() bool {
	cmd := exec.Command(s.pythonCmd, "--version")
	output, err := cmd.Output()
	if err != nil {
		return false
	}
	return strings.HasPrefix(string(output), "Python 3")
}

// GenerateNanoBanana runs the Nano Banana image generation script.
func (s *Service) GenerateNanoBanana(inputImage, outputImage string, customPrompt string, onProgress ProgressCallback) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	scriptPath := filepath.Join(s.pipelineDir, "generate_nano.py")
	args := []string{scriptPath, "--input", inputImage, "--output", outputImage}
	if customPrompt != "" {
		args = append(args, "--prompt", customPrompt)
	}

	return s.runPythonScript(args, onProgress)
}

// ConvertToModel runs the TripoSR image-to-3D conversion script.
func (s *Service) ConvertToModel(inputImage, outputModel string, onProgress ProgressCallback) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	scriptPath := filepath.Join(s.pipelineDir, "image_to_3d.py")
	args := []string{scriptPath, "--image", inputImage, "--output", outputModel}

	return s.runPythonScript(args, onProgress)
}

// GenerateVisemes runs the viseme generation script for lip-sync.
func (s *Service) GenerateVisemes(audioPath, facePath, outputPath string, onProgress ProgressCallback) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	scriptPath := filepath.Join(s.pipelineDir, "generate_visemes.py")
	args := []string{scriptPath, "--audio", audioPath, "--output", outputPath}
	if facePath != "" {
		args = append(args, "--face", facePath)
	}

	return s.runPythonScript(args, onProgress)
}

// SynthesizeSpeech runs the Moshi TTS script.
func (s *Service) SynthesizeSpeech(text, outputPath string, onProgress ProgressCallback) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	scriptPath := filepath.Join(s.pipelineDir, "moshi_tts.py")
	args := []string{scriptPath, "--text", text, "--output", outputPath}

	return s.runPythonScript(args, onProgress)
}

// RunFullPipeline executes the complete character creation pipeline:
// 1. Generate Nano Banana image from source photo
// 2. Convert styled image to 3D GLB model
func (s *Service) RunFullPipeline(inputImage, charDir string, onProgress ProgressCallback) (nanoBananaPath, modelPath string, err error) {
	nanoBananaPath = filepath.Join(charDir, "nano_banana.png")
	modelPath = filepath.Join(charDir, "model.glb")

	// Step 1: Generate Nano Banana styled image
	if onProgress != nil {
		onProgress("nano_banana", "Generating Nano Banana figurine image...")
	}
	if err := s.GenerateNanoBanana(inputImage, nanoBananaPath, "", onProgress); err != nil {
		return "", "", fmt.Errorf("nano banana generation failed: %w", err)
	}

	// Step 2: Convert to 3D model
	if onProgress != nil {
		onProgress("image_to_3d", "Converting to 3D model...")
	}
	// Use the Nano Banana output as input for 3D conversion
	imageFor3D := nanoBananaPath
	if _, err := os.Stat(nanoBananaPath); os.IsNotExist(err) {
		// Fall back to original image if Nano Banana failed
		imageFor3D = inputImage
	}

	if err := s.ConvertToModel(imageFor3D, modelPath, onProgress); err != nil {
		return nanoBananaPath, "", fmt.Errorf("3D conversion failed: %w", err)
	}

	return nanoBananaPath, modelPath, nil
}

// runPythonScript executes a Python script and streams its JSON output.
func (s *Service) runPythonScript(args []string, onProgress ProgressCallback) error {
	cmd := exec.Command(s.pythonCmd, args...)

	// Set up environment for Mac GPU support
	env := os.Environ()
	if runtime.GOOS == "darwin" {
		env = append(env, "PYTORCH_ENABLE_MPS_FALLBACK=1")
	}
	cmd.Env = env

	// Capture stdout for JSON progress messages
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	// Capture stderr for error messages
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	slog.Info("[Pipeline] Running script", "args", args)

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start script: %w", err)
	}

	// Read stderr in background
	var stderrOutput strings.Builder
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			stderrOutput.WriteString(line + "\n")
			slog.Debug("[Pipeline] stderr", "line", line)
		}
	}()

	// Read stdout line by line for JSON progress
	scanner := bufio.NewScanner(stdout)
	var lastResult StepResult
	for scanner.Scan() {
		line := scanner.Text()

		var result StepResult
		if err := json.Unmarshal([]byte(line), &result); err != nil {
			slog.Debug("[Pipeline] non-JSON output", "line", line)
			continue
		}

		lastResult = result

		switch result.Status {
		case "progress":
			slog.Info("[Pipeline] Progress", "step", result.Step, "message", result.Message)
			if onProgress != nil {
				onProgress(result.Step, result.Message)
			}
		case "success":
			slog.Info("[Pipeline] Success", "output", result.Output, "message", result.Message)
		case "error":
			slog.Error("[Pipeline] Error from script", "error", result.Error)
			// Don't return here - let cmd.Wait() finish
		}
	}

	if err := cmd.Wait(); err != nil {
		errMsg := stderrOutput.String()
		if lastResult.Error != "" {
			errMsg = lastResult.Error
		}
		return fmt.Errorf("script failed: %w\n%s", err, errMsg)
	}

	if lastResult.Status == "error" {
		return fmt.Errorf("script reported error: %s", lastResult.Error)
	}

	return nil
}

// GetPipelineDir returns the directory containing the Python scripts.
func (s *Service) GetPipelineDir() string {
	return s.pipelineDir
}
