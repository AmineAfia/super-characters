/**
 * Pipedream client wrapper for frontend
 * Interfaces with Go backend Pipedream service via Wails bindings
 */

// Types matching Go structs
export interface PipedreamApp {
  id: string;
  name_slug: string;
  name: string;
  description: string;
  auth_type: string;
  img_src: string;
  categories: string[];
  featured_weight: number;
}

export interface ConnectedAccountApp {
  name_slug: string;
  name: string;
  img_src?: string;
}

export interface ConnectedAccount {
  id: string;
  name: string;
  external_id?: string;
  healthy: boolean;
  dead: boolean;
  app: ConnectedAccountApp;
  created_at: string;
  updated_at?: string;
}

export interface TokenResponse {
  token: string;
  expires_at: string;
  connect_link_url: string;
}

export interface MCPConfig {
  serverUrl: string;
  projectId: string;
  environment: string;
}

// Default external user ID for this desktop app (single user)
const EXTERNAL_USER_ID = "desktop-user";

/**
 * Check if Pipedream is configured
 */
export async function isPipedreamConfigured(): Promise<boolean> {
  try {
    const { IsPipedreamConfigured } = await import("@/bindings/super-characters/app");
    return await IsPipedreamConfigured();
  } catch (e) {
    console.error("Failed to check Pipedream configuration:", e);
    return false;
  }
}

/**
 * Set Pipedream credentials
 */
export async function setPipedreamCredentials(
  clientId: string,
  clientSecret: string,
  projectId: string,
  environment: string = "development"
): Promise<string> {
  try {
    const { SetPipedreamCredentials } = await import("@/bindings/super-characters/app");
    return await SetPipedreamCredentials(clientId, clientSecret, projectId, environment);
  } catch (e) {
    console.error("Failed to set Pipedream credentials:", e);
    return `Error: ${e}`;
  }
}

/**
 * Get MCP configuration
 */
export async function getMCPConfig(): Promise<MCPConfig | null> {
  try {
    const { GetPipedreamMCPConfig } = await import("@/bindings/super-characters/app");
    const config = await GetPipedreamMCPConfig();
    if (!config) return null;
    
    // Extract the expected properties from the map
    return {
      serverUrl: config["serverUrl"] || "",
      projectId: config["projectId"] || "",
      environment: config["environment"] || "development",
    };
  } catch (e) {
    console.error("Failed to get MCP config:", e);
    return null;
  }
}

/**
 * Get MCP access token for server authentication
 */
export async function getMCPAccessToken(): Promise<string | null> {
  try {
    const { GetPipedreamMCPAccessToken } = await import("@/bindings/super-characters/app");
    return await GetPipedreamMCPAccessToken();
  } catch (e) {
    console.error("Failed to get MCP access token:", e);
    return null;
  }
}

/**
 * Create a connect token for the frontend SDK
 */
export async function createConnectToken(): Promise<TokenResponse | null> {
  try {
    const { CreatePipedreamConnectToken } = await import("@/bindings/super-characters/app");
    return await CreatePipedreamConnectToken(EXTERNAL_USER_ID) as TokenResponse;
  } catch (e) {
    console.error("Failed to create connect token:", e);
    return null;
  }
}

/**
 * List available Pipedream apps
 */
export async function listApps(query: string = "", limit: number = 50): Promise<PipedreamApp[]> {
  try {
    const { ListPipedreamApps } = await import("@/bindings/super-characters/app");
    const apps = await ListPipedreamApps(query, limit);
    return apps as PipedreamApp[];
  } catch (e) {
    console.error("Failed to list Pipedream apps:", e);
    return [];
  }
}

/**
 * List connected accounts
 */
export async function listConnectedAccounts(): Promise<ConnectedAccount[]> {
  try {
    const { ListPipedreamConnectedAccounts } = await import("@/bindings/super-characters/app");
    const accounts = await ListPipedreamConnectedAccounts(EXTERNAL_USER_ID);
    return accounts as ConnectedAccount[];
  } catch (e) {
    console.error("Failed to list connected accounts:", e);
    return [];
  }
}

/**
 * Delete a connected account
 */
export async function deleteConnectedAccount(accountId: string): Promise<boolean> {
  try {
    const { DeletePipedreamConnectedAccount } = await import("@/bindings/super-characters/app");
    await DeletePipedreamConnectedAccount(accountId);
    return true;
  } catch (e) {
    console.error("Failed to delete connected account:", e);
    return false;
  }
}

/**
 * Get Connect Link URL for connecting an app
 * Opens in external browser for OAuth flow
 */
export async function getConnectLinkURL(appSlug: string): Promise<string | null> {
  try {
    const { GetPipedreamConnectLinkURL } = await import("@/bindings/super-characters/app");
    return await GetPipedreamConnectLinkURL(EXTERNAL_USER_ID, appSlug);
  } catch (e) {
    console.error("Failed to get Connect Link URL:", e);
    return null;
  }
}

/**
 * Open Connect Link in external browser
 * Uses Go backend to open URL in system browser (window.open doesn't work in Wails)
 */
export async function connectApp(appSlug: string): Promise<boolean> {
  try {
    const { OpenPipedreamConnectLink } = await import("@/bindings/super-characters/app");
    await OpenPipedreamConnectLink(EXTERNAL_USER_ID, appSlug);
    return true;
  } catch (e) {
    console.error("Failed to open connect link:", e);
    return false;
  }
}

/**
 * Get the external user ID used for this desktop app
 */
export function getExternalUserId(): string {
  return EXTERNAL_USER_ID;
}

// Popular apps to show by default
export const POPULAR_APPS = [
  "slack",
  "github",
  "notion",
  "google_sheets",
  "gmail",
  "google_calendar",
  "linear",
  "airtable",
  "discord",
  "hubspot",
  "salesforce",
  "stripe",
  "twilio",
  "openai",
  "anthropic",
];
