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

/**
 * Create the conversation agent with MCP tools from connected apps
 * Async version that loads MCP tools before creating the agent
 */
export async function createConversationAgentWithMCP() {
  // Load MCP tools if not already loaded
  if (!mcpToolsLoaded) {
    try {
      const hasApps = await hasConnectedApps();
      if (hasApps) {
        console.log("[Agent] Loading MCP tools from connected apps...");
        cachedMCPTools = await loadMCPTools();
        console.log(`[Agent] Loaded ${Object.keys(cachedMCPTools).length} MCP tools`);
      }
      mcpToolsLoaded = true;
    } catch (error) {
      console.error("[Agent] Failed to load MCP tools:", error);
      mcpToolsLoaded = true; // Mark as loaded to prevent retry loops
    }
  }

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
