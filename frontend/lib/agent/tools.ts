/**
 * Tool definitions for the conversation agent
 * 
 * This file is extensible - add new tools here as the agent's capabilities grow.
 * Tools allow the agent to perform actions and retrieve information.
 */

import { tool } from "ai";
import { z } from "zod";

/**
 * Get current date and time
 * A simple tool that demonstrates the pattern for adding more complex tools
 */
export const getCurrentTime = tool({
  description: "Get the current date and time",
  inputSchema: z.object({}),
  execute: async () => {
    const now = new Date();
    return {
      date: now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      time: now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      timestamp: now.toISOString(),
    };
  },
});

/**
 * All available tools for the conversation agent
 * Add new tools here to make them available to the agent
 */
export const agentTools = {
  getCurrentTime,
  // Future tools can be added here:
  // webSearch: webSearchTool,
  // calculator: calculatorTool,
  // weather: weatherTool,
} as const;

export type AgentTools = typeof agentTools;
