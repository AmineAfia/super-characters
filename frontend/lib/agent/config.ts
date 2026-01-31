/**
 * Agent configuration and system instructions
 */

export const AGENT_CONFIG = {
  model: "gemini-2.0-flash",
  maxOutputTokens: 256,
  temperature: 0.7,
} as const;

export const SYSTEM_INSTRUCTIONS = `You are a helpful, friendly voice assistant. Your responses will be spoken aloud, so:

- Keep responses concise (1-3 sentences unless more detail is specifically requested)
- Use natural, conversational language
- Avoid using markdown formatting, bullet points, or special characters
- Don't use emojis unless specifically asked
- Be warm and personable while remaining professional
- If you don't know something, say so honestly
- For complex topics, offer to explain in more detail if the user wants

Remember: Your words will be converted to speech, so write as you would speak.`;

/**
 * Get the Gemini API key from localStorage
 */
export function getGeminiApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("gemini_api_key");
}

/**
 * Set the Gemini API key in localStorage
 */
export function setGeminiApiKey(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("gemini_api_key", key);
}

/**
 * Check if the agent is configured with an API key
 */
export function isAgentConfigured(): boolean {
  const key = getGeminiApiKey();
  return key !== null && key.length > 0;
}
