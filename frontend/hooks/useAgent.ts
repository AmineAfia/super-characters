"use client";

import { useState, useCallback, useRef } from "react";
import type { ConversationMessage } from "@/lib/agent";

export interface UseAgentState {
  isProcessing: boolean;
  isStreaming: boolean;
  error: string | null;
  messages: ConversationMessage[];
  currentResponse: string;
}

export interface UseAgentActions {
  sendMessage: (text: string) => Promise<string>;
  clearMessages: () => void;
  reset: () => void;
}

export interface UseAgentOptions {
  onStreamStart?: () => void;
  onStreamChunk?: (chunk: string, fullText: string) => void;
  onStreamComplete?: (fullText: string) => void;
  onError?: (error: string) => void;
}

export function useAgent(options?: UseAgentOptions): UseAgentState & UseAgentActions {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentResponse, setCurrentResponse] = useState("");

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const sendMessage = useCallback(async (text: string): Promise<string> => {
    setIsProcessing(true);
    setIsStreaming(false);
    setError(null);
    setCurrentResponse("");

    try {
      // Dynamically import agent to avoid SSR issues
      const { createConversationAgent, isAgentConfigured } = await import("@/lib/agent");

      if (!isAgentConfigured()) {
        throw new Error("Gemini API key not configured. Please add it in Settings.");
      }

      // Add user message to history
      const userMessage: ConversationMessage = { role: "user", content: text };
      setMessages((prev) => [...prev, userMessage]);

      // Create agent and start streaming
      const agent = createConversationAgent();

      // Build messages array for the agent
      const allMessages = [...messages, userMessage];
      const prompt = allMessages
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n");

      optionsRef.current?.onStreamStart?.();
      setIsStreaming(true);

      // Stream the response
      const result = await agent.stream({
        prompt,
        onStepFinish: async ({ usage, finishReason }) => {
          console.log("[Agent] Step finished:", { 
            tokens: usage?.totalTokens, 
            reason: finishReason 
          });
        },
      });

      let fullText = "";

      for await (const chunk of result.textStream) {
        fullText += chunk;
        setCurrentResponse(fullText);
        optionsRef.current?.onStreamChunk?.(chunk, fullText);
      }

      setIsStreaming(false);
      setCurrentResponse("");

      // Add assistant response to history
      const assistantMessage: ConversationMessage = { role: "assistant", content: fullText };
      setMessages((prev) => [...prev, assistantMessage]);

      optionsRef.current?.onStreamComplete?.(fullText);
      setIsProcessing(false);

      return fullText;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      setIsProcessing(false);
      setIsStreaming(false);
      setCurrentResponse("");
      optionsRef.current?.onError?.(errorMessage);
      throw err;
    }
  }, [messages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentResponse("");
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setIsProcessing(false);
    setIsStreaming(false);
    setError(null);
    setMessages([]);
    setCurrentResponse("");
  }, []);

  return {
    isProcessing,
    isStreaming,
    error,
    messages,
    currentResponse,
    sendMessage,
    clearMessages,
    reset,
  };
}
