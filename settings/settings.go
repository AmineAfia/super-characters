package settings

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// Settings holds application configuration.
type Settings struct {
	GeminiAPIKey      string `json:"geminiApiKey"`
	ElevenLabsAPIKey  string `json:"elevenLabsApiKey"`
	ElevenLabsVoiceID string `json:"elevenLabsVoiceId"`
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
