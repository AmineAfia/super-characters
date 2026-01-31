package gemini

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ChatMessage represents a single message in a conversation.
type ChatMessage struct {
	Role    string `json:"role"`    // "system", "user", "assistant"
	Content string `json:"content"` // message text
}

// GeminiService handles communication with the Gemini API.
type GeminiService struct {
	apiKey string
	model  string
}

// NewGeminiService creates a new Gemini service.
func NewGeminiService() *GeminiService {
	return &GeminiService{
		model: DefaultModel,
	}
}

// SetAPIKey sets the API key.
func (s *GeminiService) SetAPIKey(key string) {
	s.apiKey = key
}

// IsConfigured returns true if the API key is set.
func (s *GeminiService) IsConfigured() bool {
	return s.apiKey != ""
}

// geminiContent is the Gemini API content format.
type geminiContent struct {
	Role  string       `json:"role"`
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiRequest struct {
	Contents          []geminiContent  `json:"contents"`
	SystemInstruction *geminiContent   `json:"systemInstruction,omitempty"`
	GenerationConfig  geminiGenConfig  `json:"generationConfig"`
}

type geminiGenConfig struct {
	MaxOutputTokens int     `json:"maxOutputTokens"`
	Temperature     float64 `json:"temperature"`
	TopP            float64 `json:"topP"`
}

// Chat sends a conversation to Gemini and returns the model's reply.
func (s *GeminiService) Chat(messages []ChatMessage) (string, error) {
	if s.apiKey == "" {
		return "", fmt.Errorf("gemini API key not configured")
	}

	var systemInstruction *geminiContent
	var contents []geminiContent

	for _, msg := range messages {
		switch msg.Role {
		case "system":
			systemInstruction = &geminiContent{
				Role: "user",
				Parts: []geminiPart{{Text: msg.Content}},
			}
		case "user":
			contents = append(contents, geminiContent{
				Role:  "user",
				Parts: []geminiPart{{Text: msg.Content}},
			})
		case "assistant":
			contents = append(contents, geminiContent{
				Role:  "model",
				Parts: []geminiPart{{Text: msg.Content}},
			})
		}
	}

	reqBody := geminiRequest{
		Contents:          contents,
		SystemInstruction: systemInstruction,
		GenerationConfig: geminiGenConfig{
			MaxOutputTokens: 256,
			Temperature:     0.7,
			TopP:            0.9,
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/models/%s:generateContent?key=%s", BaseURL, s.model, s.apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Post(url, "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("failed to call Gemini API: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read Gemini response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gemini API returned status %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to decode Gemini response: %w", err)
	}

	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("gemini returned no content")
	}

	return result.Candidates[0].Content.Parts[0].Text, nil
}
