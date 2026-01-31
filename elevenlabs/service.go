package elevenlabs

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ElevenLabsService handles communication with the ElevenLabs TTS API.
type ElevenLabsService struct {
	apiKey  string
	voiceID string
	model   string
}

// NewElevenLabsService creates a new ElevenLabs service.
func NewElevenLabsService() *ElevenLabsService {
	return &ElevenLabsService{
		voiceID: DefaultVoiceID,
		model:   DefaultModel,
	}
}

// SetAPIKey sets the API key.
func (s *ElevenLabsService) SetAPIKey(key string) {
	s.apiKey = key
}

// SetVoiceID sets the voice ID.
func (s *ElevenLabsService) SetVoiceID(voiceID string) {
	if voiceID != "" {
		s.voiceID = voiceID
	}
}

// GetVoiceID returns the current voice ID.
func (s *ElevenLabsService) GetVoiceID() string {
	return s.voiceID
}

// IsConfigured returns true if the API key is set.
func (s *ElevenLabsService) IsConfigured() bool {
	return s.apiKey != ""
}

// Synthesize converts text to speech and returns MP3 bytes.
func (s *ElevenLabsService) Synthesize(text string) ([]byte, error) {
	if s.apiKey == "" {
		return nil, fmt.Errorf("elevenlabs API key not configured")
	}

	reqBody := map[string]interface{}{
		"text":     text,
		"model_id": s.model,
		"voice_settings": map[string]interface{}{
			"stability":        0.5,
			"similarity_boost": 0.75,
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/text-to-speech/%s", BaseURL, s.voiceID)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("xi-api-key", s.apiKey)
	req.Header.Set("Accept", "audio/mpeg")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call ElevenLabs API: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read ElevenLabs response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("elevenlabs API returned status %d: %s", resp.StatusCode, string(body))
	}

	fmt.Printf("[ElevenLabs] Synthesized %d bytes of audio\n", len(body))
	return body, nil
}
