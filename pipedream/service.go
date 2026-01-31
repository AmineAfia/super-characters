package pipedream

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sync"
	"time"
)

// #region agent log
const debugLogPath = "/Users/amine/Projects/solo/super-characters/.cursor/debug.log"

func debugLog(location, message string, data map[string]interface{}) {
	entry := map[string]interface{}{
		"location":  location,
		"message":   message,
		"data":      data,
		"timestamp": time.Now().UnixMilli(),
		"sessionId": "debug-session",
	}
	jsonBytes, _ := json.Marshal(entry)
	f, err := os.OpenFile(debugLogPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err == nil {
		f.Write(jsonBytes)
		f.Write([]byte("\n"))
		f.Close()
	}
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// #endregion

const (
	// API endpoints
	baseURL      = "https://api.pipedream.com/v1"
	tokenURL     = "https://api.pipedream.com/v1/oauth/token"
	connectURL   = "https://api.pipedream.com/v1/connect" // Note: project ID must be appended
	appsURL      = "https://api.pipedream.com/v1/apps"
	mcpServerURL = "https://remote.mcp.pipedream.net"
)

// Service handles Pipedream API interactions
type Service struct {
	config      Config
	client      *http.Client
	accessToken string
	tokenExpiry time.Time
	mu          sync.RWMutex
}

// NewService creates a new Pipedream service
func NewService() *Service {
	return &Service{
		config: DefaultConfig(),
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Configure sets the Pipedream API credentials
func (s *Service) Configure(config Config) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config = config
	// Clear cached token when config changes
	s.accessToken = ""
	s.tokenExpiry = time.Time{}
}

// GetConfig returns the current configuration
func (s *Service) GetConfig() Config {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config
}

// IsConfigured returns whether the service is configured
func (s *Service) IsConfigured() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config.IsConfigured()
}

// getAccessToken returns a valid OAuth access token, refreshing if needed
func (s *Service) getAccessToken() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// #region agent log
	debugLog("service.go:getAccessToken:entry", "Getting access token", map[string]interface{}{
		"hypothesisId":    "A,B,C",
		"hasCachedToken":  s.accessToken != "",
		"clientIdPrefix":  s.config.ClientID[:minInt(10, len(s.config.ClientID))],
		"projectId":       s.config.ProjectID,
		"tokenURL":        tokenURL,
	})
	// #endregion

	// Return cached token if still valid (with 1 minute buffer)
	if s.accessToken != "" && time.Now().Add(time.Minute).Before(s.tokenExpiry) {
		// #region agent log
		debugLog("service.go:getAccessToken:cached", "Using cached token", map[string]interface{}{
			"hypothesisId":      "C",
			"tokenLength":       len(s.accessToken),
			"tokenPrefix":       s.accessToken[:minInt(20, len(s.accessToken))],
		})
		// #endregion
		return s.accessToken, nil
	}

	// Request new token
	data := url.Values{}
	data.Set("grant_type", "client_credentials")
	data.Set("client_id", s.config.ClientID)
	data.Set("client_secret", s.config.ClientSecret)

	// #region agent log
	debugLog("service.go:getAccessToken:request", "Requesting new token", map[string]interface{}{
		"hypothesisId": "A,B",
		"tokenURL":     tokenURL,
		"grantType":    "client_credentials",
		"contentType":  "application/x-www-form-urlencoded",
	})
	// #endregion

	req, err := http.NewRequest("POST", tokenURL, bytes.NewBufferString(data.Encode()))
	if err != nil {
		return "", fmt.Errorf("failed to create token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to request token: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	// #region agent log
	debugLog("service.go:getAccessToken:response", "Token response received", map[string]interface{}{
		"hypothesisId": "A,B,C",
		"statusCode":   resp.StatusCode,
		"bodyPreview":  string(body[:minInt(200, len(body))]),
	})
	// #endregion

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		TokenType   string `json:"token_type"`
	}
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", fmt.Errorf("failed to decode token response: %w", err)
	}

	// #region agent log
	debugLog("service.go:getAccessToken:parsed", "Token parsed successfully", map[string]interface{}{
		"hypothesisId":  "C",
		"hasToken":      tokenResp.AccessToken != "",
		"tokenLength":   len(tokenResp.AccessToken),
		"tokenPrefix":   tokenResp.AccessToken[:minInt(20, len(tokenResp.AccessToken))],
		"expiresIn":     tokenResp.ExpiresIn,
		"tokenType":     tokenResp.TokenType,
	})
	// #endregion

	s.accessToken = tokenResp.AccessToken
	s.tokenExpiry = time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)

	return s.accessToken, nil
}

// CreateConnectToken creates a short-lived token for the frontend SDK
func (s *Service) CreateConnectToken(externalUserID string) (*TokenResponse, error) {
	if !s.IsConfigured() {
		return nil, fmt.Errorf("pipedream not configured")
	}

	accessToken, err := s.getAccessToken()
	if err != nil {
		return nil, fmt.Errorf("failed to get access token: %w", err)
	}

	payload := map[string]interface{}{
		"external_user_id": externalUserID,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Connect API URL includes project ID in path: /v1/connect/{project_id}/tokens
	reqURL := fmt.Sprintf("%s/%s/tokens", connectURL, s.config.ProjectID)

	// #region agent log
	debugLog("service.go:CreateConnectToken:request", "Creating connect token", map[string]interface{}{
		"hypothesisId":    "G",
		"reqURL":          reqURL,
		"authType":        "Bearer",
		"projectId":       s.config.ProjectID,
		"environment":     s.config.Environment,
		"externalUserID":  externalUserID,
	})
	// #endregion

	req, err := http.NewRequest("POST", reqURL, bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-PD-Environment", s.config.Environment)

	// #region agent log
	debugLog("service.go:CreateConnectToken:headers", "Request headers set", map[string]interface{}{
		"hypothesisId":   "G",
		"authType":       "Bearer",
		"hasEnvironment": s.config.Environment != "",
		"tokenPrefix":    accessToken[:minInt(20, len(accessToken))],
	})
	// #endregion

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to create connect token: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	// #region agent log
	debugLog("service.go:CreateConnectToken:response", "Create token response", map[string]interface{}{
		"hypothesisId": "G",
		"statusCode":   resp.StatusCode,
		"bodyPreview":  string(respBody[:minInt(200, len(respBody))]),
	})
	// #endregion

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("create token failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var tokenResp TokenResponse
	if err := json.Unmarshal(respBody, &tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	return &tokenResp, nil
}

// GetMCPAccessToken returns an access token for MCP server authentication
func (s *Service) GetMCPAccessToken() (string, error) {
	if !s.IsConfigured() {
		return "", fmt.Errorf("pipedream not configured")
	}
	return s.getAccessToken()
}

// GetMCPConfig returns the MCP configuration for the frontend
func (s *Service) GetMCPConfig() map[string]string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return map[string]string{
		"serverUrl":   mcpServerURL,
		"projectId":   s.config.ProjectID,
		"environment": s.config.Environment,
	}
}

// ListApps lists available Pipedream apps with optional search
func (s *Service) ListApps(query string, limit int) ([]App, error) {
	if !s.IsConfigured() {
		return nil, fmt.Errorf("pipedream not configured")
	}

	accessToken, err := s.getAccessToken()
	if err != nil {
		return nil, fmt.Errorf("failed to get access token: %w", err)
	}

	reqURL := appsURL
	params := url.Values{}
	if query != "" {
		params.Set("q", query)
	}
	if limit > 0 {
		params.Set("limit", fmt.Sprintf("%d", limit))
	}
	params.Set("sort_key", "featured_weight")
	params.Set("sort_direction", "desc")

	if len(params) > 0 {
		reqURL += "?" + params.Encode()
	}

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-PD-Project-Id", s.config.ProjectID)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to list apps: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("list apps failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Data []App `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode apps response: %w", err)
	}

	return result.Data, nil
}

// ListConnectedAccounts lists accounts connected by a user
func (s *Service) ListConnectedAccounts(externalUserID string) ([]ConnectedAccount, error) {
	if !s.IsConfigured() {
		return nil, fmt.Errorf("pipedream not configured")
	}

	accessToken, err := s.getAccessToken()
	if err != nil {
		return nil, fmt.Errorf("failed to get access token: %w", err)
	}

	// Connect API URL includes project ID in path: /v1/connect/{project_id}/accounts
	reqURL := fmt.Sprintf("%s/%s/accounts?external_user_id=%s", connectURL, s.config.ProjectID, url.QueryEscape(externalUserID))

	// #region agent log
	debugLog("service.go:ListConnectedAccounts:request", "Listing connected accounts", map[string]interface{}{
		"hypothesisId":    "G",
		"reqURL":          reqURL,
		"authType":        "Bearer",
		"projectId":       s.config.ProjectID,
		"environment":     s.config.Environment,
	})
	// #endregion

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-PD-Environment", s.config.Environment)

	// #region agent log
	debugLog("service.go:ListConnectedAccounts:headers", "Request headers set", map[string]interface{}{
		"hypothesisId":   "G",
		"authType":       "Bearer",
		"tokenPrefix":    accessToken[:minInt(20, len(accessToken))],
	})
	// #endregion

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to list accounts: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	// #region agent log
	debugLog("service.go:ListConnectedAccounts:response", "List accounts response", map[string]interface{}{
		"hypothesisId": "G",
		"statusCode":   resp.StatusCode,
		"bodyPreview":  string(respBody[:minInt(200, len(respBody))]),
	})
	// #endregion

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("list accounts failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Data []ConnectedAccount `json:"data"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to decode accounts response: %w", err)
	}

	return result.Data, nil
}

// DeleteConnectedAccount removes a connected account
func (s *Service) DeleteConnectedAccount(accountID string) error {
	if !s.IsConfigured() {
		return fmt.Errorf("pipedream not configured")
	}

	accessToken, err := s.getAccessToken()
	if err != nil {
		return fmt.Errorf("failed to get access token: %w", err)
	}

	// Connect API URL includes project ID in path: /v1/connect/{project_id}/accounts/{account_id}
	reqURL := fmt.Sprintf("%s/%s/accounts/%s", connectURL, s.config.ProjectID, accountID)
	req, err := http.NewRequest("DELETE", reqURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-PD-Environment", s.config.Environment)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete account: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delete account failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// GetConnectLinkURL returns a Connect Link URL for connecting an app
func (s *Service) GetConnectLinkURL(externalUserID, appSlug string) (string, error) {
	tokenResp, err := s.CreateConnectToken(externalUserID)
	if err != nil {
		return "", err
	}

	// Construct Connect Link URL with app parameter
	connectLinkURL := tokenResp.ConnectLinkURL
	if connectLinkURL == "" {
		connectLinkURL = fmt.Sprintf("https://pipedream.com/_static/connect.html?token=%s", tokenResp.Token)
	}

	// Add app parameter
	u, err := url.Parse(connectLinkURL)
	if err != nil {
		return "", fmt.Errorf("failed to parse connect link URL: %w", err)
	}
	q := u.Query()
	q.Set("app", appSlug)
	u.RawQuery = q.Encode()

	return u.String(), nil
}
