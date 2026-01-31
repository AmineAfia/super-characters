package pipedream

// Config holds Pipedream API configuration
type Config struct {
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
	ProjectID    string `json:"projectId"`
	Environment  string `json:"environment"` // "development" or "production"
}

// DefaultConfig returns the default Pipedream configuration
func DefaultConfig() Config {
	return Config{
		Environment: "development",
	}
}

// IsConfigured returns whether the Pipedream API credentials are set
func (c Config) IsConfigured() bool {
	return c.ClientID != "" && c.ClientSecret != "" && c.ProjectID != ""
}

// ConnectedAccountApp represents the app info nested in a connected account
type ConnectedAccountApp struct {
	NameSlug string `json:"name_slug"`
	Name     string `json:"name"`
	ImgSrc   string `json:"img_src"`
}

// ConnectedAccount represents an account connected via Pipedream
type ConnectedAccount struct {
	ID         string              `json:"id"`
	Name       string              `json:"name"`
	ExternalID string              `json:"external_id,omitempty"`
	Healthy    bool                `json:"healthy"`
	Dead       bool                `json:"dead"`
	App        ConnectedAccountApp `json:"app"`
	CreatedAt  string              `json:"created_at"`
	UpdatedAt  string              `json:"updated_at,omitempty"`
}

// AppSlug returns the app slug from the nested app object
func (c ConnectedAccount) AppSlug() string {
	return c.App.NameSlug
}

// AppName returns the app name from the nested app object
func (c ConnectedAccount) AppName() string {
	return c.App.Name
}

// App represents a Pipedream app/integration
type App struct {
	ID              string   `json:"id"`
	NameSlug        string   `json:"name_slug"`
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	AuthType        string   `json:"auth_type"`
	ImgSrc          string   `json:"img_src"`
	Categories      []string `json:"categories"`
	FeaturedWeight  int      `json:"featured_weight"`
}

// TokenResponse represents a Pipedream Connect token
type TokenResponse struct {
	Token          string `json:"token"`
	ExpiresAt      string `json:"expires_at"`
	ConnectLinkURL string `json:"connect_link_url"`
}
