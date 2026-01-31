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
  conversation: ConversationTurn[]
  currentTranscript: string
  error: string | null
}

export interface ConversationActions {
  startConversation: () => Promise<void>
  stopConversation: () => Promise<void>
  clearConversation: () => void
}

export interface ConversationAudio {
  text: string
  audioBase64: string | null
}

interface UseConversationOptions {
  onAudioReceived?: (audio: ConversationAudio) => void
}

export function useConversation(options?: UseConversationOptions): ConversationState & ConversationActions {
  const [isActive, setIsActive] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [conversation, setConversation] = useState<ConversationTurn[]>([])
  const [currentTranscript, setCurrentTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)

  const onAudioReceivedRef = useRef(options?.onAudioReceived)
  onAudioReceivedRef.current = options?.onAudioReceived

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

    const setupEventListeners = async () => {
      const { Events } = await import("@wailsio/runtime")

      unsubResponse = Events.On("conversation:response", async (event: any) => {
        const { text, audio } = event.data || {}
        setIsThinking(false)
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

      unsubThinking = Events.On("conversation:thinking", () => {
        setIsThinking(true)
        setError(null)
      })

      unsubError = Events.On("conversation:error", (event: any) => {
        setIsThinking(false)
        const errorMsg = event.data?.error || "Unknown error"
        setError(errorMsg)
        setConversation((prev) => [...prev, { role: "assistant", text: `Error: ${errorMsg}` }])
      })

      unsubUserMessage = Events.On("conversation:user-message", (event: any) => {
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
      })

      // Listen for transcription segments during recording
      unsubSegment = Events.On("transcription-segment", (event: any) => {
        const text = event.data?.text
        if (text) {
          setCurrentTranscript((prev) => prev + text + " ")
        }
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
    }
  }, [])

  const startConversation = useCallback(async () => {
    try {
      const { StartConversation } = await import("@/bindings/super-characters/app")
      await StartConversation()
      setIsActive(true)
      setConversation([])
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
    } catch (e) {
      console.error("Failed to stop conversation:", e)
    }
  }, [])

  const clearConversation = useCallback(() => {
    setConversation([])
    setCurrentTranscript("")
    setError(null)
  }, [])

  return {
    isActive,
    isListening,
    isThinking,
    conversation,
    currentTranscript,
    error,
    startConversation,
    stopConversation,
    clearConversation,
  }
}
