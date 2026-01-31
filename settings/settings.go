package settings

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// DefaultSilenceDurationMs is the default silence duration for VAD
const DefaultSilenceDurationMs = 300

// Settings holds application configuration.
type Settings struct {
	GeminiAPIKey       string `json:"geminiApiKey"`
	ElevenLabsAPIKey   string `json:"elevenLabsApiKey"`
	ElevenLabsVoiceID  string `json:"elevenLabsVoiceId"`
	PressAndTalkHotkey string `json:"pressAndTalkHotkey"`
	SilenceDurationMs  int    `json:"silenceDurationMs"` // Silence duration for VAD (default: 300ms)

	// Pipedream Connect settings
	PipedreamClientID     string `json:"pipedreamClientId"`
	PipedreamClientSecret string `json:"pipedreamClientSecret"`
	PipedreamProjectID    string `json:"pipedreamProjectId"`
	PipedreamEnvironment  string `json:"pipedreamEnvironment"` // "development" or "production"
}

// SettingsService manages persistent settings storage.
type SettingsService struct {
	settings Settings
	path     string
	mu       sync.RWMutex
}

// NewSettingsService creates a new settings service.
// Settings are stored in ~/.super-characters/settings.json
func NewSettingsService() (*SettingsService, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}

	configDir := filepath.Join(homeDir, ".super-characters")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create config directory: %w", err)
	}

	s := &SettingsService{
		path: filepath.Join(configDir, "settings.json"),
	}

	// Load existing settings if available
	if err := s.load(); err != nil {
		// If file doesn't exist, that's okay - we start with defaults
		if !os.IsNotExist(err) {
			fmt.Printf("[Settings] Warning: failed to load settings: %v\n", err)
		}
	}

	return s, nil
}

// load reads settings from disk.
func (s *SettingsService) load() error {
	data, err := os.ReadFile(s.path)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := json.Unmarshal(data, &s.settings); err != nil {
		return fmt.Errorf("failed to parse settings: %w", err)
	}

	return nil
}

// save writes settings to disk.
func (s *SettingsService) save() error {
	s.mu.RLock()
	data, err := json.MarshalIndent(s.settings, "", "  ")
	s.mu.RUnlock()

	if err != nil {
		return fmt.Errorf("failed to marshal settings: %w", err)
	}

	if err := os.WriteFile(s.path, data, 0600); err != nil {
		return fmt.Errorf("failed to write settings: %w", err)
	}

	return nil
}

// GetSettings returns a copy of the current settings.
func (s *SettingsService) GetSettings() Settings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.settings
}

// UpdateSettings updates all settings and persists to disk.
func (s *SettingsService) UpdateSettings(settings Settings) error {
	s.mu.Lock()
	s.settings = settings
	s.mu.Unlock()

	return s.save()
}

// SetGeminiAPIKey updates the Gemini API key.
func (s *SettingsService) SetGeminiAPIKey(key string) error {
	s.mu.Lock()
	s.settings.GeminiAPIKey = key
	s.mu.Unlock()

	return s.save()
}

// SetElevenLabsAPIKey updates the ElevenLabs API key.
func (s *SettingsService) SetElevenLabsAPIKey(key string) error {
	s.mu.Lock()
	s.settings.ElevenLabsAPIKey = key
	s.mu.Unlock()

	return s.save()
}

// SetElevenLabsVoiceID updates the ElevenLabs voice ID.
func (s *SettingsService) SetElevenLabsVoiceID(voiceID string) error {
	s.mu.Lock()
	s.settings.ElevenLabsVoiceID = voiceID
	s.mu.Unlock()

	return s.save()
}

// SetPressAndTalkHotkey updates the press-and-talk hotkey.
func (s *SettingsService) SetPressAndTalkHotkey(hotkey string) error {
	s.mu.Lock()
	s.settings.PressAndTalkHotkey = hotkey
	s.mu.Unlock()

	return s.save()
}

// GetPressAndTalkHotkey returns the press-and-talk hotkey with a default fallback.
func (s *SettingsService) GetPressAndTalkHotkey() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.settings.PressAndTalkHotkey == "" {
		return "Ctrl+Shift+Space" // Default hotkey
	}
	return s.settings.PressAndTalkHotkey
}

// SetSilenceDurationMs updates the silence duration for VAD.
func (s *SettingsService) SetSilenceDurationMs(durationMs int) error {
	// Clamp to valid range (100ms - 1000ms)
	if durationMs < 100 {
		durationMs = 100
	}
	if durationMs > 1000 {
		durationMs = 1000
	}

	s.mu.Lock()
	s.settings.SilenceDurationMs = durationMs
	s.mu.Unlock()

	return s.save()
}

// GetSilenceDurationMs returns the silence duration with a default fallback.
func (s *SettingsService) GetSilenceDurationMs() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.settings.SilenceDurationMs <= 0 {
		return DefaultSilenceDurationMs
	}
	return s.settings.SilenceDurationMs
}

// SetPipedreamClientID updates the Pipedream client ID.
func (s *SettingsService) SetPipedreamClientID(clientID string) error {
	s.mu.Lock()
	s.settings.PipedreamClientID = clientID
	s.mu.Unlock()

	return s.save()
}

// SetPipedreamClientSecret updates the Pipedream client secret.
func (s *SettingsService) SetPipedreamClientSecret(clientSecret string) error {
	s.mu.Lock()
	s.settings.PipedreamClientSecret = clientSecret
	s.mu.Unlock()

	return s.save()
}

// SetPipedreamProjectID updates the Pipedream project ID.
func (s *SettingsService) SetPipedreamProjectID(projectID string) error {
	s.mu.Lock()
	s.settings.PipedreamProjectID = projectID
	s.mu.Unlock()

	return s.save()
}

// SetPipedreamEnvironment updates the Pipedream environment.
func (s *SettingsService) SetPipedreamEnvironment(environment string) error {
	// Validate environment value
	if environment != "development" && environment != "production" {
		environment = "development"
	}

	s.mu.Lock()
	s.settings.PipedreamEnvironment = environment
	s.mu.Unlock()

	return s.save()
}

// GetPipedreamEnvironment returns the Pipedream environment with a default fallback.
func (s *SettingsService) GetPipedreamEnvironment() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.settings.PipedreamEnvironment == "" {
		return "development"
	}
	return s.settings.PipedreamEnvironment
}

// IsPipedreamConfigured returns whether Pipedream credentials are set.
func (s *SettingsService) IsPipedreamConfigured() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.settings.PipedreamClientID != "" &&
		s.settings.PipedreamClientSecret != "" &&
		s.settings.PipedreamProjectID != ""
}
