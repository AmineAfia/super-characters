/**
 * Main agent definition using AI SDK v6 ToolLoopAgent
 */

import { ToolLoopAgent, stepCountIs } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { AGENT_CONFIG, SYSTEM_INSTRUCTIONS, getGeminiApiKey } from "./config";
import { agentTools } from "./tools";

export { getGeminiApiKey, setGeminiApiKey, isAgentConfigured } from "./config";
export { agentTools } from "./tools";

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
export function createConversationAgent() {
  const google = createGoogleProvider();

  return new ToolLoopAgent({
    model: google(AGENT_CONFIG.model),
    instructions: SYSTEM_INSTRUCTIONS,
    tools: agentTools,
    stopWhen: stepCountIs(10), // Allow up to 10 steps for multi-tool workflows
    maxOutputTokens: AGENT_CONFIG.maxOutputTokens,
    temperature: AGENT_CONFIG.temperature,
  });
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
