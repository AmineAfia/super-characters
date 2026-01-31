/**
 * MCP (Model Context Protocol) integration for Pipedream tools
 * Connects AI SDK agent to Pipedream MCP server for 3000+ app integrations
 */

import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  getMCPConfig,
  getMCPAccessToken,
  listConnectedAccounts,
  getExternalUserId,
  type ConnectedAccount,
} from "@/lib/pipedream/client";

// MCP Server URL
const MCP_SERVER_URL = "https://remote.mcp.pipedream.net";

// Cache for MCP clients per app
const mcpClientCache = new Map<string, MCPClient>();

// #region agent log - debug instrumentation
function debugLog(location: string, message: string, data: Record<string, unknown>) {
  fetch('http://127.0.0.1:7245/ingest/506e96e1-a135-4e8a-8d08-13cb65f0f430', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location, message, data, timestamp: Date.now(), sessionId: 'debug-session' })
  }).catch(() => {});
}
// #endregion

/**
 * Create an MCP client for a specific app
 */
export async function createPipedreamMCPClient(appSlug: string): Promise<MCPClient | null> {
  try {
    // Check cache first
    const cached = mcpClientCache.get(appSlug);
    if (cached) {
      return cached;
    }

    // Get MCP config and access token
    const [config, accessToken] = await Promise.all([
      getMCPConfig(),
      getMCPAccessToken(),
    ]);

    // #region agent log
    debugLog('mcp.ts:createPipedreamMCPClient:config', 'Got config and token', {
      hypothesisId: 'H',
      hasConfig: !!config,
      hasAccessToken: !!accessToken,
      projectId: config?.projectId,
      environment: config?.environment,
      appSlug,
    });
    // #endregion

    if (!config || !accessToken) {
      console.warn("[MCP] Pipedream not configured or failed to get access token");
      return null;
    }

    const externalUserId = getExternalUserId();

    // Create transport with authentication headers
    const transport = new StreamableHTTPClientTransport(
      new URL(MCP_SERVER_URL),
      {
        requestInit: {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "x-pd-project-id": config.projectId,
            "x-pd-environment": config.environment,
            "x-pd-external-user-id": externalUserId,
            "x-pd-app-slug": appSlug,
          },
        },
      }
    );

    // #region agent log
    debugLog('mcp.ts:createPipedreamMCPClient:transport', 'Created transport', {
      hypothesisId: 'H',
      serverUrl: MCP_SERVER_URL,
      appSlug,
      externalUserId,
    });
    // #endregion

    // Create MCP client
    const mcpClient = await createMCPClient({ transport });

    // Cache the client
    mcpClientCache.set(appSlug, mcpClient);

    // #region agent log
    debugLog('mcp.ts:createPipedreamMCPClient:success', 'Created MCP client', {
      hypothesisId: 'H',
      appSlug,
    });
    // #endregion

    console.log(`[MCP] Created client for ${appSlug}`);
    return mcpClient;
  } catch (error) {
    // #region agent log
    debugLog('mcp.ts:createPipedreamMCPClient:error', 'Failed to create client', {
      hypothesisId: 'H',
      appSlug,
      error: String(error),
    });
    // #endregion
    console.error(`[MCP] Failed to create client for ${appSlug}:`, error);
    return null;
  }
}

/**
 * Load MCP tools for all connected apps
 * Returns a combined tools object for use with AI SDK
 */
export async function loadMCPTools(): Promise<Record<string, unknown>> {
  try {
    // Get list of connected accounts
    const connectedAccounts = await listConnectedAccounts();

    // #region agent log
    debugLog('mcp.ts:loadMCPTools:accounts', 'Got connected accounts', {
      hypothesisId: 'H',
      accountCount: connectedAccounts.length,
      accounts: connectedAccounts.map(a => a.app.name_slug),
    });
    // #endregion

    if (connectedAccounts.length === 0) {
      console.log("[MCP] No connected accounts, skipping MCP tools");
      return {};
    }

    console.log(`[MCP] Loading tools for ${connectedAccounts.length} connected apps`);

    // Load tools for each connected app
    const allTools: Record<string, unknown> = {};

    for (const account of connectedAccounts) {
      try {
        const mcpClient = await createPipedreamMCPClient(account.app.name_slug);
        if (mcpClient) {
          // Get tools from MCP client
          const tools = await mcpClient.tools();

          // #region agent log
          debugLog('mcp.ts:loadMCPTools:toolsLoaded', 'Loaded tools from app', {
            hypothesisId: 'H',
            appSlug: account.app.name_slug,
            toolCount: Object.keys(tools).length,
            toolNames: Object.keys(tools).slice(0, 10), // First 10 tool names
          });
          // #endregion

          // Merge tools with a prefix to avoid conflicts
          for (const [toolName, tool] of Object.entries(tools)) {
            // Prefix tool name with app slug for clarity
            const prefixedName = `${account.app.name_slug}_${toolName}`;
            allTools[prefixedName] = tool;
          }

          console.log(`[MCP] Loaded ${Object.keys(tools).length} tools from ${account.app.name_slug}`);
        }
      } catch (error) {
        // #region agent log
        debugLog('mcp.ts:loadMCPTools:appError', 'Failed to load tools for app', {
          hypothesisId: 'H',
          appSlug: account.app.name_slug,
          error: String(error),
        });
        // #endregion
        console.error(`[MCP] Failed to load tools for ${account.app.name_slug}:`, error);
      }
    }

    // #region agent log
    debugLog('mcp.ts:loadMCPTools:complete', 'MCP tools loading complete', {
      hypothesisId: 'H',
      totalToolCount: Object.keys(allTools).length,
      allToolNames: Object.keys(allTools),
    });
    // #endregion

    console.log(`[MCP] Total MCP tools loaded: ${Object.keys(allTools).length}`);
    return allTools;
  } catch (error) {
    // #region agent log
    debugLog('mcp.ts:loadMCPTools:error', 'Failed to load MCP tools', {
      hypothesisId: 'H',
      error: String(error),
    });
    // #endregion
    console.error("[MCP] Failed to load MCP tools:", error);
    return {};
  }
}

/**
 * Load MCP tools for specific apps
 */
export async function loadMCPToolsForApps(appSlugs: string[]): Promise<Record<string, unknown>> {
  const allTools: Record<string, unknown> = {};

  for (const appSlug of appSlugs) {
    try {
      const mcpClient = await createPipedreamMCPClient(appSlug);
      if (mcpClient) {
        const tools = await mcpClient.tools();

        for (const [toolName, tool] of Object.entries(tools)) {
          const prefixedName = `${appSlug}_${toolName}`;
          allTools[prefixedName] = tool;
        }

        console.log(`[MCP] Loaded ${Object.keys(tools).length} tools from ${appSlug}`);
      }
    } catch (error) {
      console.error(`[MCP] Failed to load tools for ${appSlug}:`, error);
    }
  }

  return allTools;
}

/**
 * Close all cached MCP clients
 */
export async function closeMCPClients(): Promise<void> {
  for (const [appSlug, client] of mcpClientCache) {
    try {
      await client.close();
      console.log(`[MCP] Closed client for ${appSlug}`);
    } catch (error) {
      console.error(`[MCP] Failed to close client for ${appSlug}:`, error);
    }
  }
  mcpClientCache.clear();
}

/**
 * Clear the MCP client cache (e.g., when connections change)
 */
export function clearMCPClientCache(): void {
  // Close existing clients first
  closeMCPClients();
}

/**
 * Get the list of connected app slugs
 */
export async function getConnectedAppSlugs(): Promise<string[]> {
  const accounts = await listConnectedAccounts();
  return accounts.map(a => a.app.name_slug);
}

/**
 * Check if any apps are connected
 */
export async function hasConnectedApps(): Promise<boolean> {
  const accounts = await listConnectedAccounts();
  return accounts.length > 0;
}
