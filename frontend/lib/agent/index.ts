/**
 * Main agent definition using AI SDK v6 ToolLoopAgent
 * Supports dynamic MCP tools from Pipedream connected apps
 */

import { ToolLoopAgent, stepCountIs } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { AGENT_CONFIG, SYSTEM_INSTRUCTIONS, getGeminiApiKey } from "./config";
import { agentTools } from "./tools";
import { loadMCPTools, clearMCPClientCache, hasConnectedApps } from "./mcp";

export { getGeminiApiKey, setGeminiApiKey, isAgentConfigured } from "./config";
export { agentTools } from "./tools";
export { loadMCPTools, clearMCPClientCache, hasConnectedApps } from "./mcp";

// Cache for loaded MCP tools
let cachedMCPTools: Record<string, unknown> = {};
let mcpToolsLoaded = false;

/**
 * Create a Google Generative AI provider with the stored API key
 */
export function createGoogleProvider() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }
  return createGoogleGenerativeAI({ apiKey });
}

/**
 * Create the conversation agent with current configuration
 * This is a factory function because we need to create a fresh provider
 * each time in case the API key has changed
 */
export function createConversationAgent(additionalTools?: Record<string, unknown>) {
  const google = createGoogleProvider();

  // Merge base tools with any additional tools (like MCP tools)
  const allTools = {
    ...agentTools,
    ...(additionalTools || {}),
  };

  return new ToolLoopAgent({
    model: google(AGENT_CONFIG.model),
    instructions: SYSTEM_INSTRUCTIONS,
    tools: allTools,
    stopWhen: stepCountIs(10), // Allow up to 10 steps for multi-tool workflows
    maxOutputTokens: AGENT_CONFIG.maxOutputTokens,
    temperature: AGENT_CONFIG.temperature,
  });
}

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
 * Create the conversation agent with MCP tools from connected apps
 * Async version that loads MCP tools before creating the agent
 */
export async function createConversationAgentWithMCP() {
  // #region agent log
  debugLog('agent/index.ts:createConversationAgentWithMCP:start', 'Creating agent with MCP', {
    hypothesisId: 'I',
    mcpToolsLoaded,
    cachedToolCount: Object.keys(cachedMCPTools).length,
  });
  // #endregion

  // Load MCP tools if not already loaded
  if (!mcpToolsLoaded) {
    try {
      const hasApps = await hasConnectedApps();
      
      // #region agent log
      debugLog('agent/index.ts:createConversationAgentWithMCP:hasApps', 'Checked for connected apps', {
        hypothesisId: 'I',
        hasApps,
      });
      // #endregion

      if (hasApps) {
        console.log("[Agent] Loading MCP tools from connected apps...");
        cachedMCPTools = await loadMCPTools();
        console.log(`[Agent] Loaded ${Object.keys(cachedMCPTools).length} MCP tools`);
        
        // #region agent log
        debugLog('agent/index.ts:createConversationAgentWithMCP:loaded', 'MCP tools loaded', {
          hypothesisId: 'I',
          toolCount: Object.keys(cachedMCPTools).length,
          toolNames: Object.keys(cachedMCPTools),
        });
        // #endregion
      }
      mcpToolsLoaded = true;
    } catch (error) {
      // #region agent log
      debugLog('agent/index.ts:createConversationAgentWithMCP:error', 'Failed to load MCP tools', {
        hypothesisId: 'I',
        error: String(error),
      });
      // #endregion
      console.error("[Agent] Failed to load MCP tools:", error);
      mcpToolsLoaded = true; // Mark as loaded to prevent retry loops
    }
  }

  // #region agent log
  debugLog('agent/index.ts:createConversationAgentWithMCP:creating', 'Creating agent with tools', {
    hypothesisId: 'I',
    mcpToolCount: Object.keys(cachedMCPTools).length,
    baseToolCount: Object.keys(agentTools).length,
  });
  // #endregion

  return createConversationAgent(cachedMCPTools);
}

/**
 * Refresh MCP tools (call after connecting/disconnecting apps)
 */
export async function refreshMCPTools(): Promise<void> {
  console.log("[Agent] Refreshing MCP tools...");
  clearMCPClientCache();
  mcpToolsLoaded = false;
  cachedMCPTools = {};

  try {
    const hasApps = await hasConnectedApps();
    if (hasApps) {
      cachedMCPTools = await loadMCPTools();
      console.log(`[Agent] Refreshed ${Object.keys(cachedMCPTools).length} MCP tools`);
    }
    mcpToolsLoaded = true;
  } catch (error) {
    console.error("[Agent] Failed to refresh MCP tools:", error);
    mcpToolsLoaded = true;
  }
}

/**
 * Get the count of loaded MCP tools
 */
export function getMCPToolCount(): number {
  return Object.keys(cachedMCPTools).length;
}

/**
 * Check if MCP tools are loaded
 */
export function areMCPToolsLoaded(): boolean {
  return mcpToolsLoaded;
}

/**
 * Message format for conversation history
 */
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Convert conversation history to AI SDK message format
 */
export function formatMessagesForAgent(
  messages: ConversationMessage[],
  newUserMessage: string
): Array<{ role: "user" | "assistant"; content: string }> {
  return [
    ...messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: "user" as const, content: newUserMessage },
  ];
}
