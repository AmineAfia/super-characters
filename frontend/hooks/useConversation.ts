"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export interface ConversationTurn {
  role: "user" | "assistant"
  text: string
}

export interface ConversationState {
  isActive: boolean
  isListening: boolean
  isThinking: boolean
  isContinuousMode: boolean
  isSpeechDetected: boolean
  conversation: ConversationTurn[]
  currentTranscript: string
  currentResponse: string
  error: string | null
  useAgentMode: boolean
}

export interface ConversationActions {
  startConversation: () => Promise<void>
  stopConversation: () => Promise<void>
  clearConversation: () => void
  setAgentMode: (enabled: boolean) => void
}

export interface ConversationAudio {
  text: string
  audioBase64: string | null
}

interface UseConversationOptions {
  onAudioReceived?: (audio: ConversationAudio) => void
  systemPrompt?: string
}

export function useConversation(options?: UseConversationOptions): ConversationState & ConversationActions {
  const [isActive, setIsActive] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isContinuousMode, setIsContinuousMode] = useState(false)
  const [isSpeechDetected, setIsSpeechDetected] = useState(false)
  const [conversation, setConversation] = useState<ConversationTurn[]>([])
  const [currentTranscript, setCurrentTranscript] = useState("")
  const [currentResponse, setCurrentResponse] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [useAgentMode, setUseAgentMode] = useState(true) // Default to agent mode

  const onAudioReceivedRef = useRef(options?.onAudioReceived)
  onAudioReceivedRef.current = options?.onAudioReceived

  const systemPromptRef = useRef(options?.systemPrompt)
  systemPromptRef.current = options?.systemPrompt

  // Ref to track conversation history for agent
  const conversationHistoryRef = useRef<ConversationTurn[]>([])

  // Process user input through the AI SDK agent
  const processWithAgent = useCallback(async (text: string) => {
    if (!text.trim()) return

    setIsThinking(true)
    setCurrentResponse("")
    setError(null)

    // Pause listening while processing to avoid picking up TTS
    try {
      const { PauseListening } = await import("@/bindings/super-characters/app")
      await PauseListening()
    } catch (e) {
      console.warn("[useConversation] Failed to pause listening:", e)
    }

    // Add user message to conversation
    const userTurn: ConversationTurn = { role: "user", text }
    setConversation((prev) => [...prev, userTurn])
    conversationHistoryRef.current = [...conversationHistoryRef.current, userTurn]

    try {
      // Dynamically import agent to avoid SSR issues
      const { createConversationAgentWithMCP, isAgentConfigured } = await import("@/lib/agent")

      if (!isAgentConfigured()) {
        throw new Error("Gemini API key not configured. Please add it in Settings.")
      }

      // Create agent with MCP tools and build messages from conversation history
      const agent = await createConversationAgentWithMCP(systemPromptRef.current)
      
      // Format as proper messages for the AI SDK
      const messages = conversationHistoryRef.current.map((m) => ({
        role: m.role,
        content: m.text,
      }))

      // Emit conversation:thinking event for overlay window
      const { Events } = await import("@wailsio/runtime")
      Events.Emit("conversation:thinking")

      // Stream the response using messages format
      const result = await agent.stream({ messages })

      let fullText = ""
      for await (const chunk of result.textStream) {
        fullText += chunk
        setCurrentResponse(fullText)
      }

      setCurrentResponse("")
      setIsThinking(false)

      // Add assistant response to conversation
      const assistantTurn: ConversationTurn = { role: "assistant", text: fullText }
      setConversation((prev) => [...prev, assistantTurn])
      conversationHistoryRef.current = [...conversationHistoryRef.current, assistantTurn]

      // Synthesize speech using Go backend
      try {
        const { SynthesizeSpeech, IsTTSConfigured, ResumeListening } = await import("@/bindings/super-characters/app")
        
        const ttsConfigured = await IsTTSConfigured()
        if (ttsConfigured) {
          const audioBase64 = await SynthesizeSpeech(fullText)
          
          // Emit conversation:response event for overlay window to update its state
          // Audio is excluded here because the main window plays it via the direct callback below.
          // Including audio would cause both windows to play simultaneously.
          const { Events } = await import("@wailsio/runtime")
          Events.Emit("conversation:response", { text: fullText, audio: null })
          
          if (onAudioReceivedRef.current) {
            onAudioReceivedRef.current({
              text: fullText,
              audioBase64: audioBase64 || null,
            })
          }

          // Estimate audio duration and resume listening after playback
          // Rough estimate: ~150 words per minute, ~5 chars per word
          const wordCount = fullText.length / 5
          const audioDurationMs = (wordCount / 150) * 60 * 1000
          const bufferMs = 500
          setTimeout(async () => {
            try {
              await ResumeListening()
            } catch (e) {
              console.warn("[useConversation] Failed to resume listening:", e)
            }
          }, audioDurationMs + bufferMs)
        } else {
          // No TTS configured, just notify with text only and resume immediately
          // Emit conversation:response event for overlay (no audio)
          const { Events } = await import("@wailsio/runtime")
          Events.Emit("conversation:response", { text: fullText, audio: null })
          
          if (onAudioReceivedRef.current) {
            onAudioReceivedRef.current({
              text: fullText,
              audioBase64: null,
            })
          }
          // Resume listening immediately since no audio playback
          try {
            await ResumeListening()
          } catch (e) {
            console.warn("[useConversation] Failed to resume listening:", e)
          }
        }
      } catch (ttsError) {
        console.warn("[useConversation] TTS synthesis failed:", ttsError)
        // Still notify with text even if TTS fails
        if (onAudioReceivedRef.current) {
          onAudioReceivedRef.current({
            text: fullText,
            audioBase64: null,
          })
        }
        // Resume listening after error
        try {
          const { ResumeListening } = await import("@/bindings/super-characters/app")
          await ResumeListening()
        } catch (e) {
          console.warn("[useConversation] Failed to resume listening:", e)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
      setError(errorMessage)
      setIsThinking(false)
      setCurrentResponse("")
      
      // Add error as assistant message
      setConversation((prev) => [...prev, { role: "assistant", text: `Error: ${errorMessage}` }])

      // Resume listening after error
      try {
        const { ResumeListening } = await import("@/bindings/super-characters/app")
        await ResumeListening()
      } catch (e) {
        console.warn("[useConversation] Failed to resume listening:", e)
      }
    }
  }, [])

  // Subscribe to conversation events
  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return

    let unsubResponse: (() => void) | undefined
    let unsubThinking: (() => void) | undefined
    let unsubError: (() => void) | undefined
    let unsubUserMessage: (() => void) | undefined
    let unsubRecording: (() => void) | undefined
    let unsubRecordingStop: (() => void) | undefined
    let unsubSegment: (() => void) | undefined
    let unsubTranscriptionComplete: (() => void) | undefined
    // Continuous mode events
    let unsubListeningStarted: (() => void) | undefined
    let unsubListeningStopped: (() => void) | undefined
    let unsubSpeechDetected: (() => void) | undefined
    let unsubProcessing: (() => void) | undefined
    let unsubListeningResumed: (() => void) | undefined

    const setupEventListeners = async () => {
      const { Events } = await import("@wailsio/runtime")

      // In agent mode, we intercept transcription-complete to process with agent
      unsubTranscriptionComplete = Events.On("transcription-complete", async (event: any) => {
        if (!useAgentMode) return // Let Go backend handle it in legacy mode
        
        const text = event.data?.text
        if (text && isActive) {
          setCurrentTranscript("")
          await processWithAgent(text)
        }
      })

      // Legacy mode: handle conversation:response from Go backend
      unsubResponse = Events.On("conversation:response", async (event: any) => {
        if (useAgentMode) return // Ignore in agent mode
        
        const { text, audio } = event.data || {}
        setIsThinking(false)
        setIsSpeechDetected(false)
        setError(null)

        if (text) {
          setConversation((prev) => [...prev, { role: "assistant", text }])
        }

        // Notify about audio for playback
        if (onAudioReceivedRef.current) {
          onAudioReceivedRef.current({
            text: text || "",
            audioBase64: audio || null,
          })
        }
      })

      // Legacy mode: handle thinking state from Go backend
      unsubThinking = Events.On("conversation:thinking", () => {
        if (useAgentMode) return // Agent mode handles its own thinking state
        
        setIsThinking(true)
        setIsSpeechDetected(false)
        setError(null)
      })

      unsubError = Events.On("conversation:error", (event: any) => {
        setIsThinking(false)
        setIsSpeechDetected(false)
        const errorMsg = event.data?.error || "Unknown error"
        setError(errorMsg)
        setConversation((prev) => [...prev, { role: "assistant", text: `Error: ${errorMsg}` }])
      })

      // Legacy mode: handle user message from Go backend
      unsubUserMessage = Events.On("conversation:user-message", (event: any) => {
        if (useAgentMode) return // Agent mode handles its own user messages
        
        const text = event.data?.text
        if (text) {
          setCurrentTranscript("")
          setConversation((prev) => [...prev, { role: "user", text }])
        }
      })

      // Listen for recording state
      unsubRecording = Events.On("overlay:show", () => {
        setIsListening(true)
        setCurrentTranscript("")
      })

      unsubRecordingStop = Events.On("overlay:hide", () => {
        setIsListening(false)
        setIsContinuousMode(false)
        setIsSpeechDetected(false)
      })

      // Listen for transcription segments during recording
      unsubSegment = Events.On("transcription-segment", (event: any) => {
        const text = event.data?.text
        if (text) {
          setCurrentTranscript((prev) => prev + text + " ")
        }
      })

      // Continuous conversation mode events
      unsubListeningStarted = Events.On("conversation:listening-started", () => {
        setIsContinuousMode(true)
        setIsListening(true)
        setIsActive(true)
      })

      unsubListeningStopped = Events.On("conversation:listening-stopped", () => {
        setIsContinuousMode(false)
        setIsListening(false)
      })

      unsubSpeechDetected = Events.On("conversation:speech-detected", () => {
        setIsSpeechDetected(true)
      })

      unsubProcessing = Events.On("conversation:processing", () => {
        setIsSpeechDetected(false)
        // Processing is between speech end and thinking
      })

      unsubListeningResumed = Events.On("conversation:listening-resumed", () => {
        setIsListening(true)
        setIsSpeechDetected(false)
        setIsThinking(false)
      })
    }

    setupEventListeners()

    return () => {
      unsubResponse?.()
      unsubThinking?.()
      unsubError?.()
      unsubUserMessage?.()
      unsubRecording?.()
      unsubRecordingStop?.()
      unsubSegment?.()
      unsubTranscriptionComplete?.()
      unsubListeningStarted?.()
      unsubListeningStopped?.()
      unsubSpeechDetected?.()
      unsubProcessing?.()
      unsubListeningResumed?.()
    }
  }, [useAgentMode, isActive, processWithAgent])

  const startConversation = useCallback(async () => {
    try {
      const { StartConversation } = await import("@/bindings/super-characters/app")
      await StartConversation()
      setIsActive(true)
      setConversation([])
      conversationHistoryRef.current = []
      setError(null)
    } catch (e) {
      console.error("Failed to start conversation:", e)
      setError("Failed to start conversation")
    }
  }, [])

  const stopConversation = useCallback(async () => {
    try {
      const { StopConversation } = await import("@/bindings/super-characters/app")
      await StopConversation()
      setIsActive(false)
      setIsListening(false)
      setIsThinking(false)
      setCurrentTranscript("")
      setCurrentResponse("")
    } catch (e) {
      console.error("Failed to stop conversation:", e)
    }
  }, [])

  const clearConversation = useCallback(() => {
    setConversation([])
    conversationHistoryRef.current = []
    setCurrentTranscript("")
    setCurrentResponse("")
    setError(null)
  }, [])

  const setAgentMode = useCallback((enabled: boolean) => {
    setUseAgentMode(enabled)
  }, [])

  return {
    isActive,
    isListening,
    isThinking,
    isContinuousMode,
    isSpeechDetected,
    conversation,
    currentTranscript,
    currentResponse,
    error,
    useAgentMode,
    startConversation,
    stopConversation,
    clearConversation,
    setAgentMode,
  }
}
