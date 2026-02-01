package avatar

import (
	"encoding/base64"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Default Ready Player Me avatar used as template (has Armature, morph targets, skeleton).
const defaultTemplateURL = "https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png"

// AvatarInfo represents a generated custom avatar.
type AvatarInfo struct {
	ID        string `json:"id"`
	Path      string `json:"path"`
	Thumbnail string `json:"thumbnail"` // base64 PNG
	CreatedAt int64  `json:"createdAt"`
}

// AvatarService manages custom avatar generation and storage.
type AvatarService struct {
	dataDir      string // ~/.super-characters/avatars/
	scriptPath   string // path to generate_avatar.py
	pythonPath   string // path to venv python binary
	templatePath string // path to cached template GLB
}

// NewAvatarService creates a new AvatarService.
func NewAvatarService() *AvatarService {
	return &AvatarService{}
}

// Initialize sets up the avatar data directory and locates the Python script and venv.
func (s *AvatarService) Initialize(appDir string) error {
	s.dataDir = filepath.Join(appDir, "avatars")
	if err := os.MkdirAll(s.dataDir, 0755); err != nil {
		return fmt.Errorf("failed to create avatars directory: %w", err)
	}

	// Look for the Python script relative to the executable or in common locations
	candidates := []string{
		filepath.Join(appDir, "scripts", "generate_avatar.py"),
		"scripts/generate_avatar.py",
	}

	// Also check relative to the working directory
	if wd, err := os.Getwd(); err == nil {
		candidates = append(candidates, filepath.Join(wd, "scripts", "generate_avatar.py"))
	}

	for _, path := range candidates {
		if _, err := os.Stat(path); err == nil {
			s.scriptPath = path
			slog.Info("[Avatar] Found script", "path", path)
			break
		}
	}

	if s.scriptPath == "" {
		slog.Warn("[Avatar] generate_avatar.py not found, avatar generation will be unavailable")
	}

	// Locate the venv python binary next to the script
	if s.scriptPath != "" {
		scriptDir := filepath.Dir(s.scriptPath)
		venvPython := filepath.Join(scriptDir, ".venv", "bin", "python3")
		if _, err := os.Stat(venvPython); err == nil {
			s.pythonPath = venvPython
			slog.Info("[Avatar] Using venv Python", "path", venvPython)
		}
	}

	// Fallback to system python3
	if s.pythonPath == "" {
		if p, err := exec.LookPath("python3"); err == nil {
			s.pythonPath = p
			slog.Info("[Avatar] Using system Python", "path", p)
		}
	}

	// Download and cache the template GLB if not present
	s.templatePath = filepath.Join(s.dataDir, "template.glb")
	if _, err := os.Stat(s.templatePath); err != nil {
		slog.Info("[Avatar] Downloading template GLB...")
		if dlErr := downloadFile(defaultTemplateURL, s.templatePath); dlErr != nil {
			slog.Warn("[Avatar] Failed to download template GLB, avatar generation may produce flat avatars", "error", dlErr)
			s.templatePath = ""
		} else {
			slog.Info("[Avatar] Template GLB cached", "path", s.templatePath)
		}
	}

	slog.Info("[Avatar] Service initialized", "dataDir", s.dataDir)
	return nil
}

// GenerateFromPhoto takes a base64-encoded photo, generates a custom avatar GLB,
// and returns the avatar info.
func (s *AvatarService) GenerateFromPhoto(photoBase64 string) (*AvatarInfo, error) {
	if s.scriptPath == "" {
		return nil, fmt.Errorf("avatar generation script not found")
	}
	if s.pythonPath == "" {
		return nil, fmt.Errorf("python3 not found")
	}

	// Create unique ID based on timestamp
	id := fmt.Sprintf("avatar_%d", time.Now().UnixMilli())
	avatarDir := filepath.Join(s.dataDir, id)
	if err := os.MkdirAll(avatarDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create avatar directory: %w", err)
	}

	// Decode and save the photo
	photoData, err := base64.StdEncoding.DecodeString(photoBase64)
	if err != nil {
		os.RemoveAll(avatarDir)
		return nil, fmt.Errorf("failed to decode photo: %w", err)
	}

	photoPath := filepath.Join(avatarDir, "photo.jpg")
	if err := os.WriteFile(photoPath, photoData, 0644); err != nil {
		os.RemoveAll(avatarDir)
		return nil, fmt.Errorf("failed to write photo: %w", err)
	}

	outputPath := filepath.Join(avatarDir, "avatar.glb")
	thumbnailPath := filepath.Join(avatarDir, "thumbnail.png")

	// Run the Python script
	args := []string{
		s.scriptPath,
		"--input", photoPath,
		"--output", outputPath,
		"--thumbnail", thumbnailPath,
	}
	if s.templatePath != "" {
		args = append(args, "--template", s.templatePath)
	}

	slog.Info("[Avatar] Running generation script", "id", id)
	cmd := exec.Command(s.pythonPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		slog.Error("[Avatar] Script failed", "error", err, "output", string(output))
		os.RemoveAll(avatarDir)
		return nil, fmt.Errorf("avatar generation failed: %s", string(output))
	}
	slog.Info("[Avatar] Generation complete", "id", id, "output", string(output))

	// Read thumbnail as base64
	thumbnailBase64 := ""
	if thumbData, err := os.ReadFile(thumbnailPath); err == nil {
		thumbnailBase64 = base64.StdEncoding.EncodeToString(thumbData)
	}

	return &AvatarInfo{
		ID:        id,
		Path:      outputPath,
		Thumbnail: thumbnailBase64,
		CreatedAt: time.Now().Unix(),
	}, nil
}

// GetAvatars returns all saved custom avatars.
func (s *AvatarService) GetAvatars() []AvatarInfo {
	var avatars []AvatarInfo

	entries, err := os.ReadDir(s.dataDir)
	if err != nil {
		slog.Warn("[Avatar] Failed to read avatars directory", "error", err)
		return avatars
	}

	for _, entry := range entries {
		if !entry.IsDir() || !strings.HasPrefix(entry.Name(), "avatar_") {
			continue
		}

		id := entry.Name()
		avatarDir := filepath.Join(s.dataDir, id)
		glbPath := filepath.Join(avatarDir, "avatar.glb")
		thumbnailPath := filepath.Join(avatarDir, "thumbnail.png")

		// Check that GLB exists
		if _, err := os.Stat(glbPath); err != nil {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		// Read thumbnail
		thumbnailBase64 := ""
		if thumbData, err := os.ReadFile(thumbnailPath); err == nil {
			thumbnailBase64 = base64.StdEncoding.EncodeToString(thumbData)
		}

		avatars = append(avatars, AvatarInfo{
			ID:        id,
			Path:      glbPath,
			Thumbnail: thumbnailBase64,
			CreatedAt: info.ModTime().Unix(),
		})
	}

	// Sort by creation time, newest first
	sort.Slice(avatars, func(i, j int) bool {
		return avatars[i].CreatedAt > avatars[j].CreatedAt
	})

	return avatars
}

// DeleteAvatar removes a custom avatar by ID.
func (s *AvatarService) DeleteAvatar(id string) error {
	if !strings.HasPrefix(id, "avatar_") {
		return fmt.Errorf("invalid avatar ID")
	}

	avatarDir := filepath.Join(s.dataDir, id)
	if _, err := os.Stat(avatarDir); err != nil {
		return fmt.Errorf("avatar not found: %s", id)
	}

	if err := os.RemoveAll(avatarDir); err != nil {
		return fmt.Errorf("failed to delete avatar: %w", err)
	}

	slog.Info("[Avatar] Deleted avatar", "id", id)
	return nil
}

// GetAvatarPath returns the GLB file path for an avatar ID.
func (s *AvatarService) GetAvatarPath(id string) (string, error) {
	if !strings.HasPrefix(id, "avatar_") {
		return "", fmt.Errorf("invalid avatar ID")
	}

	glbPath := filepath.Join(s.dataDir, id, "avatar.glb")
	if _, err := os.Stat(glbPath); err != nil {
		return "", fmt.Errorf("avatar not found: %s", id)
	}

	return glbPath, nil
}

// downloadFile fetches a URL and saves it to the given path.
func downloadFile(url, destPath string) error {
	resp, err := http.Get(url)
	if err != nil {
		return fmt.Errorf("HTTP GET failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status: %s", resp.Status)
	}

	f, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}
	defer f.Close()

	if _, err := io.Copy(f, resp.Body); err != nil {
		os.Remove(destPath)
		return fmt.Errorf("write file: %w", err)
	}
	return nil
}

// CheckPythonDependencies verifies that the venv Python and required packages are available.
func (s *AvatarService) CheckPythonDependencies() error {
	if s.pythonPath == "" {
		return fmt.Errorf("python3 not found")
	}

	// Check required packages using find_spec (avoids triggering broken transitive imports)
	packages := []string{"mediapipe", "cv2", "numpy", "PIL", "pygltflib"}
	var missing []string
	for _, pkg := range packages {
		check := fmt.Sprintf("import importlib.util; exit(0 if importlib.util.find_spec('%s') else 1)", pkg)
		cmd := exec.Command(s.pythonPath, "-c", check)
		if err := cmd.Run(); err != nil {
			missing = append(missing, pkg)
		}
	}

	if len(missing) > 0 {
		return fmt.Errorf("missing Python packages: %s", strings.Join(missing, ", "))
	}

	return nil
}
