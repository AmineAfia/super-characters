package transcription

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	goruntime "runtime"
	"strings"
	"sync"
	"time"

	"super-characters/utils"

	whisper "github.com/ggerganov/whisper.cpp/bindings/go/pkg/whisper"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// HardwareProfile represents detected hardware capabilities
type HardwareProfile struct {
	CPUCores        int
	PerformanceTier string // "low", "medium", "high", "ultra"
}

// AdaptiveConfig holds adaptive Whisper configuration
type AdaptiveConfig struct {
	Threads     int
	BeamSize    int
	Temperature float32
}

// DetectHardware detects system hardware capabilities
func DetectHardware() HardwareProfile {
	cpuCores := goruntime.NumCPU()
	
	var tier string
	switch {
	case cpuCores >= 8:
		tier = "ultra"
	case cpuCores >= 6:
		tier = "high"
	case cpuCores >= 4:
		tier = "medium"
	default:
		tier = "low"
	}
	
	return HardwareProfile{
		CPUCores:        cpuCores,
		PerformanceTier: tier,
	}
}

// GetAdaptiveConfig returns adaptive Whisper configuration based on hardware
func GetAdaptiveConfig(profile HardwareProfile) AdaptiveConfig {
	// Uniformly use performance-focused settings (Greedy Sampling)
	// VoiceInk uses Greedy (BeamSize=1) and Temp=0.2 for speed/latency
	return AdaptiveConfig{
		Threads:     min(profile.CPUCores, 8),
		BeamSize:    1,   // Greedy sampling for best latency
		Temperature: 0.2, // Slight creativity, matches VoiceInk
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ModelUnloadTimeout defines when to unload the Whisper model from memory
type ModelUnloadTimeout string

const (
	ModelUnloadNever       ModelUnloadTimeout = "never"
	ModelUnloadImmediately ModelUnloadTimeout = "immediately"
	ModelUnload30Seconds   ModelUnloadTimeout = "30s"
	ModelUnload1Minute     ModelUnloadTimeout = "1m"
	ModelUnload5Minutes    ModelUnloadTimeout = "5m"
)

// TranscriptionService handles speech-to-text using whisper.cpp
type TranscriptionService struct {
	model            whisper.Model
	context          whisper.Context
	modelPath        string
	currentModelName string
	modelMutex       sync.RWMutex
	processMutex     sync.Mutex // Ensure only one Process call runs at a time
	lastPrompt       string     // For prompt chaining - stores last ~200 chars of transcription
	app              *application.App

	// Model memory management
	lastActivityTime  time.Time
	unloadTimeout     ModelUnloadTimeout
	idleCheckStop     chan struct{}
	idleCheckRunning  bool
}

// SetApp sets the Wails application instance
func (t *TranscriptionService) SetApp(app *application.App) {
	t.app = app
}

// NewTranscriptionService creates a new transcription service
func NewTranscriptionService() *TranscriptionService {
	return &TranscriptionService{
		modelPath:        getModelPath("base.en"), // Default to base.en
		currentModelName: "base.en",
		unloadTimeout:    ModelUnloadNever, // Default: keep loaded
		lastActivityTime: time.Now(),
	}
}

// getModelPath returns the appropriate path for the model file
func getModelPath(modelName string) string {
	if modelName == "" {
		modelName = "large-v3-turbo-q8_0"
	}
	filename := fmt.Sprintf("ggml-%s.bin", modelName)

	// 1. Check user config directory (writable location)
	if configDir, err := os.UserConfigDir(); err == nil {
		modelPath := filepath.Join(configDir, "supercharacters", "models", filename)
		// If it exists here, return it immediately
		if _, err := os.Stat(modelPath); err == nil {
			return modelPath
		}
		// If we are getting the path to write/download, we prefer this location
		// But if we are just looking for an existing model, we should check others too
	}
	
	// 2. Try to get the executable directory (works for built apps, read-only mostly)
	if execPath, err := os.Executable(); err == nil {
		execDir := filepath.Dir(execPath)

		// For macOS app bundles, check Resources directory
		modelPath := filepath.Join(execDir, "..", "Resources", filename)
		if _, err := os.Stat(modelPath); err == nil {
			return modelPath
		}

		// Also try relative to executable directory (legacy/windows portable)
		modelPath = filepath.Join(execDir, "models", filename)
		if _, err := os.Stat(modelPath); err == nil {
			return modelPath
		}
	}

	// 3. Fallback to user config directory for new downloads
	if configDir, err := os.UserConfigDir(); err == nil {
		return filepath.Join(configDir, "supercharacters", "models", filename)
	}

	// 4. Ultimate fallback to relative path (dev mode)
	return filepath.Join("models", filename)
}

// Initialize loads the Whisper model and creates a context
func (t *TranscriptionService) Initialize(modelName string) (err error) {
	if modelName == "" {
		modelName = "base.en" // Default model
	}
	
	// Update current model name (caller handles locking if needed)
	t.currentModelName = modelName

	slog.Info("starting transcription service initialization")

	defer func() {
		if r := recover(); r != nil {
			slog.Error("panic during transcription service initialization", "panic", r)
			err = fmt.Errorf("panic during initialization: %v", r)
		}
	}()

	slog.Info("initializing transcription service", "model_path", t.modelPath)

	// Ensure models directory exists
	modelsDir := filepath.Dir(t.modelPath)
	if err := os.MkdirAll(modelsDir, 0755); err != nil {
		return fmt.Errorf("failed to create models directory %s: %w", modelsDir, err)
	}

	// Check if model exists
	if _, err := os.Stat(t.modelPath); os.IsNotExist(err) {
		slog.Warn("model not found, skipping auto-download", "path", t.modelPath)
		// Return error so caller knows service isn't ready, but don't crash or block
		return fmt.Errorf("model not found at %s", t.modelPath)
	} else if err != nil {
		return fmt.Errorf("failed to check model file %s: %w", t.modelPath, err)
	} else {
		slog.Info("model found", "path", t.modelPath)
	}

	// Load the model
	slog.Info("loading whisper model")
	model, err := whisper.New(t.modelPath)
	if err != nil {
		return fmt.Errorf("failed to load whisper model from %s: %w", t.modelPath, err)
	}
	slog.Info("whisper model loaded successfully")

	// Create context
	slog.Info("creating whisper context")
	defer func() {
		if r := recover(); r != nil {
			slog.Error("panic during context creation", "panic", r)
		}
	}()
	context, err := model.NewContext()
	if err != nil {
		model.Close()
		return fmt.Errorf("failed to create whisper context: %w", err)
	}
	slog.Info("whisper context created successfully")

	slog.Info("about to assign model and context")

	t.model = model
	t.context = context

	slog.Info("model and context assigned successfully")

	slog.Info("configuring whisper context")
	
	// Detect hardware and get adaptive configuration
	hwProfile := DetectHardware()
	adaptiveConfig := GetAdaptiveConfig(hwProfile)
	
	slog.Info("hardware detected", "cpu_cores", hwProfile.CPUCores, "tier", hwProfile.PerformanceTier)
	slog.Info("adaptive config", "threads", adaptiveConfig.Threads, "beam_size", adaptiveConfig.BeamSize, "temperature", adaptiveConfig.Temperature)
	
	// Configure context for real-time transcription with adaptive settings
	context.SetThreads(uint(adaptiveConfig.Threads)) // Adaptive thread count
	slog.Info("set threads", "threads", adaptiveConfig.Threads)
	context.SetTranslate(false) // Transcribe to English
	slog.Info("set translate", "translate", false)
	context.SetLanguage("auto") // Default to auto-detect; caller sets specific language via SetLanguage()
	slog.Info("set language", "language", "auto")
	context.SetMaxSegmentLength(200) // Reasonable segment length limit
	slog.Info("set max segment length", "max_segment_length", 200)

	// 1. Enable Beam Search with adaptive beam size
	context.SetBeamSize(adaptiveConfig.BeamSize)
	slog.Info("set beam size", "beam_size", adaptiveConfig.BeamSize)

	// 2. Set Entropy Threshold to reduce hallucinations
	context.SetEntropyThold(2.4) // Match VoiceInk default (was 2.2)
	slog.Info("set entropy threshold", "entropy_thold", 2.4)

	// 3. Set Temperature with adaptive value for quality/speed balance
	context.SetTemperature(adaptiveConfig.Temperature)
	slog.Info("set temperature", "temperature", adaptiveConfig.Temperature)

	// 4. Enable Temperature Fallback
	context.SetTemperatureFallback(0.2)
	slog.Info("set temperature fallback", "temperature_fallback", 0.2)

	// 5. Repetition Penalty not available in bindings, relying on VAD/Entropy
	// context.SetRepetitionPenalty(1.1)
	// fmt.Println("Set repetition penalty: 1.1")

	// Note: no-speech threshold is controlled via VAD threshold instead
	// The whisper.cpp Go bindings don't expose SetNoSpeechThold directly
	// VAD threshold of 0.50 effectively handles silence detection
	
	// Set initial prompt to stabilize the model - using minimal prompt to avoid hallucinations
	// With longer context windows (5s), we can use prompts safely
	context.SetInitialPrompt("Meeting transcription.")
	slog.Info("set initial prompt", "prompt", "Meeting transcription.")

	// 5. Enable Voice Activity Detection (VAD) to reduce processing of silence
	// Check for VAD model
	vadModelName := "silero-v6.2.0"
	vadModelPath := getModelPath(vadModelName)
	vadEnabled := false

	if _, err := os.Stat(vadModelPath); os.IsNotExist(err) {
		slog.Info("VAD model not found, downloading", "path", vadModelPath)
		// Try to download VAD model
		// We use a simplified download here directly since downloadModel assumes it's in the supported list
		// Or we can add it to supported list but that might confuse the UI if not handled
		// For now, let's just reuse the helper if possible or implement simple download
		vadURL := "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin"
		
		if err := func() error {
			resp, err := http.Get(vadURL)
			if err != nil {
				return err
			}
			defer resp.Body.Close()
			if resp.StatusCode != http.StatusOK {
				return fmt.Errorf("HTTP %d", resp.StatusCode)
			}
			out, err := os.Create(vadModelPath)
			if err != nil {
				return err
			}
			defer out.Close()
			_, err = io.Copy(out, resp.Body)
			return err
		}(); err != nil {
			slog.Error("failed to download VAD model, VAD will be disabled", "error", err)
		} else {
			slog.Info("VAD model downloaded", "path", vadModelPath)
			vadEnabled = true
		}
	} else {
		vadEnabled = true
	}

	if vadEnabled {
		context.SetVAD(true)
		context.SetVADModelPath(vadModelPath)
		// Tune VAD parameters for better speech segment detection
		// Based on meeting-minutes best practices
		context.SetVADThreshold(0.50)
		context.SetVADMinSpeechMs(250)       // 250ms (Matches VoiceInk) - prevents chopping words
		context.SetVADMinSilenceMs(100)      // 100ms (Matches VoiceInk) - cuts sooner
		// Note: Higher min_speech prevents Whisper from processing very short segments
		// that often result in hallucinations or empty transcriptions
		
		slog.Info("set VAD", "enabled", true, "model", vadModelPath, "threshold", 0.50, "min_speech_ms", 250, "min_silence_ms", 100)
	} else {
		context.SetVAD(false)
		slog.Info("set VAD", "enabled", false, "reason", "model missing")
	}

	context.SetTokenTimestamps(false)
	slog.Info("set token timestamps", "enabled", false)

	slog.Info("whisper transcription service initialized successfully")
	return nil
}

// SetLanguage updates the language used for transcription
func (t *TranscriptionService) SetLanguage(lang string) error {
	t.modelMutex.RLock()
	defer t.modelMutex.RUnlock()

	if t.context == nil {
		return fmt.Errorf("transcription service not initialized")
	}

	// Resolve language code from name
	langCode := GetLanguageCode(lang)
	slog.Info("setting language", "language", lang, "code", langCode)

	// Update the prompt based on language
	// Prompt removed to prevent hallucinations
	// prompt := "The following is a live transcription of a conversation."
	// if lang != "en" {
	// 	prompt = "The following is a live transcription of a conversation." // Consider localizing this if possible
	// }
	// t.context.SetInitialPrompt(prompt)

	return t.context.SetLanguage(langCode)
}

// GetLanguages returns the list of supported languages
func (t *TranscriptionService) GetLanguages() []string {
	if t.model == nil {
		return []string{"en"} // Default fallback
	}
	return t.model.Languages()
}

// Process transcribes audio samples and emits events
func (t *TranscriptionService) Process(samples []float32, appCtx context.Context) (string, string, error) {
	// Ensure model is loaded (handles lazy loading after idle unload)
	if err := t.ensureModelLoaded(); err != nil {
		return "", "", err
	}

	// Update activity time for idle tracking
	t.updateActivityTime()

	// Ensure exclusive access to the whisper context for processing
	t.processMutex.Lock()
	defer t.processMutex.Unlock()

	// Process the audio samples
	var segments []whisper.Segment

	// Use segment callback to collect results in real-time
	segmentCallback := func(segment whisper.Segment) {
		segments = append(segments, segment)

		// Emit transcription event to frontend
		if t.app != nil {
			t.app.Event.Emit("transcription-segment", map[string]interface{}{
				"text":      segment.Text,
				"start":     segment.Start.Seconds(),
				"end":       segment.End.Seconds(),
				"timestamp": time.Now().Unix(),
			})
		}

		slog.Info("transcription segment", "start", segment.Start.Seconds(), "end", segment.End.Seconds(), "text", segment.Text)
	}

	// Process with callbacks
	err := t.context.Process(samples, nil, segmentCallback, nil)
	if err != nil {
		return "", "", fmt.Errorf("failed to process audio: %w", err)
	}

	// Also emit a combined transcription event
	var fullText strings.Builder
	for _, segment := range segments {
		fullText.WriteString(segment.Text)
		fullText.WriteString(" ")
	}

	if t.app != nil && fullText.Len() > 0 {
		t.app.Event.Emit("transcription-complete", map[string]interface{}{
			"text":      strings.TrimSpace(fullText.String()),
			"segments":  len(segments),
			"timestamp": time.Now().Unix(),
		})
	}

	// Update prompt context for chaining - use last transcription as context for next segment
	// PERFORMANCE: Disable prompt chaining to prevent hallucination loops and improve stability
	finalText := strings.TrimSpace(fullText.String())
	// if finalText != "" {
	// 	t.UpdatePromptContext(finalText)
	// }

	// Get detected language
	detectedLang := t.context.DetectedLanguage()
	slog.Info("detected language", "language", detectedLang)

	return finalText, detectedLang, nil
}

// Close cleans up resources
func (t *TranscriptionService) Close() error {
	// Stop idle checker if running
	if t.idleCheckRunning && t.idleCheckStop != nil {
		close(t.idleCheckStop)
		t.idleCheckRunning = false
	}

	if t.context != nil {
		// Note: whisper.Context doesn't have a Close method in the interface
		// The underlying resources are managed by the model
		t.context = nil
	}

	if t.model != nil {
		// Close the model (this should clean up contexts too)
		t.model.Close()
		t.model = nil
	}

	// Clear prompt state
	t.lastPrompt = ""

	slog.Info("whisper transcription service closed")
	return nil
}

// UpdatePromptContext stores the last ~200 characters of transcription as context
// for the next transcription segment. This helps Whisper maintain consistency
// and accuracy across chunk boundaries (prompt chaining).
func (t *TranscriptionService) UpdatePromptContext(text string) {
	if text == "" {
		return
	}
	
	// Keep last 200 characters for context
	if len(text) > 200 {
		text = text[len(text)-200:]
	}
	
	t.lastPrompt = text
	
	// Update the whisper context's initial prompt for the next processing call
	if t.context != nil {
		t.context.SetInitialPrompt(text)
		snippet := text
		if len(snippet) > 50 {
			snippet = snippet[len(snippet)-50:]
		}
		slog.Info("updated prompt context", "snippet", snippet)
	}
}

// ResetPromptContext clears the prompt context (call when starting a new recording session)
func (t *TranscriptionService) ResetPromptContext() {
	t.lastPrompt = ""
	if t.context != nil {
		t.context.SetInitialPrompt("Meeting transcription.")
		slog.Info("reset prompt context to default")
	}
}

// IsInitialized returns whether the service is ready for transcription
func (t *TranscriptionService) IsInitialized() bool {
	initialized := t.model != nil && t.context != nil
	slog.Info("IsInitialized called", "model_loaded", t.model != nil, "context_loaded", t.context != nil, "result", initialized)
	return initialized
}

// downloadModel downloads the specified model from Hugging Face
func (t *TranscriptionService) downloadModel(modelName string) error {
	// Get the model URL from the supported models list
	models := GetSupportedModels()
	var modelURL string

	for _, model := range models {
		if model.Name == modelName {
			modelURL = model.Url
			break
		}
	}

	if modelURL == "" {
		return fmt.Errorf("unsupported model: %s", modelName)
	}

	// Update model path to use the correct filename
	t.modelPath = getModelPath(modelName)

	slog.Info("downloading model", "url", modelURL)

	err := utils.DownloadFile(modelURL, t.modelPath, nil)
	if err != nil {
		return fmt.Errorf("failed to download model: %w", err)
	}

	slog.Info("model downloaded successfully", "path", t.modelPath)
	return nil
}

// DownloadModel downloads a model with progress tracking and emits events
func (t *TranscriptionService) DownloadModel(ctx context.Context, modelName string) error {
	// Get the model info from the supported models list
	models := GetSupportedModels()
	var modelURL string
	var modelFileName string

	for _, model := range models {
		if model.Name == modelName {
			modelURL = model.Url
			modelFileName = model.FileName
			break
		}
	}

	if modelURL == "" {
		return fmt.Errorf("unsupported model: %s", modelName)
	}

	if modelFileName == "" {
		modelFileName = fmt.Sprintf("ggml-%s.bin", modelName)
	}

	// Update model path to use the correct filename
	modelPath := getModelPath(modelName)

	// Check if model already exists
	if _, err := os.Stat(modelPath); err == nil {
		return fmt.Errorf("model %s already exists", modelName)
	}

	slog.Info("downloading model", "model", modelName, "url", modelURL)

	progressCallback := func(progress float64) {
		// Emit progress event to frontend
		if t.app != nil {
			t.app.Event.Emit("model-download-progress", map[string]interface{}{
				"model":    modelName,
				"progress": progress,
				"filename": modelFileName,
			})
		}
	}

	err := utils.DownloadFile(modelURL, modelPath, progressCallback)
	if err != nil {
		return fmt.Errorf("failed to download model: %w", err)
	}

	slog.Info("model downloaded successfully", "model", modelName, "path", modelPath)

	// Emit completion event
	if t.app != nil {
		t.app.Event.Emit("model-download-complete", map[string]interface{}{
			"model":    modelName,
			"filename": modelFileName,
			"path":     modelPath,
		})
	}

	return nil
}

// ListModels returns a list of all supported models with their current status
func (t *TranscriptionService) ListModels() []ModelInfo {
	t.modelMutex.RLock()
	currentModel := t.currentModelName
	t.modelMutex.RUnlock()

	models := GetSupportedModels()
	for i := range models {
		// Check if model is downloaded
		modelPath := getModelPath(models[i].Name)
		if _, err := os.Stat(modelPath); err == nil {
			models[i].IsDownloaded = true
		}

		// Check if model is currently active
		models[i].IsActive = models[i].Name == currentModel
	}

	return models
}

// SwitchModel switches to a different model, stopping transcription if running
func (t *TranscriptionService) SwitchModel(ctx context.Context, modelName string) error {
	// Validate model exists in supported list
	models := GetSupportedModels()
	var found bool
	for _, model := range models {
		if model.Name == modelName {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("unsupported model: %s", modelName)
	}

	// Check if model is downloaded
	modelPath := getModelPath(modelName)
	if _, err := os.Stat(modelPath); os.IsNotExist(err) {
		return fmt.Errorf("model %s is not downloaded", modelName)
	}

	t.modelMutex.Lock()
	defer t.modelMutex.Unlock()

	// If switching to the same model, do nothing
	if t.currentModelName == modelName {
		return nil
	}

	slog.Info("switching model", "from", t.currentModelName, "to", modelName)

	// Close current model and context
	if err := t.Close(); err != nil {
		slog.Warn("error closing current model", "error", err)
	}

	// Update current model name
	t.currentModelName = modelName
	t.modelPath = modelPath

	// Re-initialize with new model
	if err := t.Initialize(modelName); err != nil {
		return fmt.Errorf("failed to initialize new model %s: %w", modelName, err)
	}

	slog.Info("successfully switched model", "model", modelName)

	// Emit event to notify frontend of model switch
	if t.app != nil {
		t.app.Event.Emit("model-switched", map[string]interface{}{
			"model": modelName,
		})
	}

	return nil
}

// SetUnloadTimeout configures when the model should be automatically unloaded
func (t *TranscriptionService) SetUnloadTimeout(timeout ModelUnloadTimeout) {
	t.modelMutex.Lock()
	defer t.modelMutex.Unlock()

	t.unloadTimeout = timeout

	// Stop existing idle checker if running
	if t.idleCheckRunning && t.idleCheckStop != nil {
		close(t.idleCheckStop)
		t.idleCheckRunning = false
	}

	// Start idle checker if timeout is not "never"
	if timeout != ModelUnloadNever && timeout != ModelUnloadImmediately {
		t.startIdleChecker()
	}

	// If immediate unload requested and model is loaded, unload now
	if timeout == ModelUnloadImmediately && t.model != nil {
		go t.unloadModel()
	}
}

// GetUnloadTimeout returns the current model unload timeout setting
func (t *TranscriptionService) GetUnloadTimeout() ModelUnloadTimeout {
	t.modelMutex.RLock()
	defer t.modelMutex.RUnlock()
	return t.unloadTimeout
}

// updateActivityTime marks the current time as last activity
func (t *TranscriptionService) updateActivityTime() {
	t.modelMutex.Lock()
	defer t.modelMutex.Unlock()
	t.lastActivityTime = time.Now()
}

// startIdleChecker starts a background goroutine to check for model idle time
func (t *TranscriptionService) startIdleChecker() {
	if t.idleCheckRunning {
		return
	}

	t.idleCheckStop = make(chan struct{})
	t.idleCheckRunning = true

	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-t.idleCheckStop:
				return
			case <-ticker.C:
				t.checkIdleAndUnload()
			}
		}
	}()
}

// checkIdleAndUnload checks if the model has been idle and unloads if needed
func (t *TranscriptionService) checkIdleAndUnload() {
	t.modelMutex.RLock()
	timeout := t.unloadTimeout
	lastActivity := t.lastActivityTime
	modelLoaded := t.model != nil
	t.modelMutex.RUnlock()

	if !modelLoaded || timeout == ModelUnloadNever {
		return
	}

	var timeoutDuration time.Duration
	switch timeout {
	case ModelUnload30Seconds:
		timeoutDuration = 30 * time.Second
	case ModelUnload1Minute:
		timeoutDuration = 1 * time.Minute
	case ModelUnload5Minutes:
		timeoutDuration = 5 * time.Minute
	default:
		return
	}

	if time.Since(lastActivity) > timeoutDuration {
		slog.Info("model idle, unloading to free memory", "idle_duration", time.Since(lastActivity))
		t.unloadModel()
	}
}

// unloadModel releases the model from memory
func (t *TranscriptionService) unloadModel() {
	t.modelMutex.Lock()
	defer t.modelMutex.Unlock()

	if t.model == nil {
		return
	}

	slog.Info("unloading whisper model to free memory")

	// Clear context first
	if t.context != nil {
		t.context = nil
	}

	// Close model
	if t.model != nil {
		t.model.Close()
		t.model = nil
	}

	// Clear prompt state
	t.lastPrompt = ""

	slog.Info("whisper model unloaded")

	// Emit event to notify frontend
	if t.app != nil {
		t.app.Event.Emit("model-unloaded", map[string]interface{}{
			"model": t.currentModelName,
		})
	}
}

// ensureModelLoaded ensures the model is loaded, reloading if necessary
func (t *TranscriptionService) ensureModelLoaded() error {
	t.modelMutex.RLock()
	if t.model != nil && t.context != nil {
		t.modelMutex.RUnlock()
		return nil
	}
	t.modelMutex.RUnlock()

	// Need to reload the model
	t.modelMutex.Lock()
	defer t.modelMutex.Unlock()

	// Double-check after acquiring write lock
	if t.model != nil && t.context != nil {
		return nil
	}

	slog.Info("reloading whisper model", "model", t.currentModelName)

	// Emit event to notify frontend of reload
	if t.app != nil {
		t.app.Event.Emit("model-loading", map[string]interface{}{
			"model": t.currentModelName,
		})
	}

	// Initialize will reload the model
	// Note: We need to release the lock temporarily as Initialize may need it
	// But since we're using the same lock, we can call the internal parts directly

	// Load the model
	model, err := whisper.New(t.modelPath)
	if err != nil {
		return fmt.Errorf("failed to reload whisper model: %w", err)
	}

	// Create context
	context, err := model.NewContext()
	if err != nil {
		model.Close()
		return fmt.Errorf("failed to create whisper context: %w", err)
	}

	t.model = model
	t.context = context

	// Reconfigure context (minimal config for reload)
	hwProfile := DetectHardware()
	adaptiveConfig := GetAdaptiveConfig(hwProfile)

	context.SetThreads(uint(adaptiveConfig.Threads))
	context.SetTranslate(false)
	context.SetLanguage("auto")
	context.SetBeamSize(adaptiveConfig.BeamSize)
	context.SetEntropyThold(2.4)
	context.SetTemperature(adaptiveConfig.Temperature)
	context.SetTemperatureFallback(0.2)
	context.SetInitialPrompt("Meeting transcription.")

	// Try to enable VAD if model exists
	vadModelPath := getModelPath("silero-v6.2.0")
	if _, err := os.Stat(vadModelPath); err == nil {
		context.SetVAD(true)
		context.SetVADModelPath(vadModelPath)
		context.SetVADThreshold(0.50)
		context.SetVADMinSpeechMs(250)
		context.SetVADMinSilenceMs(100)
	}

	slog.Info("whisper model reloaded successfully", "model", t.currentModelName)

	// Emit event to notify frontend
	if t.app != nil {
		t.app.Event.Emit("model-loaded", map[string]interface{}{
			"model": t.currentModelName,
		})
	}

	return nil
}
