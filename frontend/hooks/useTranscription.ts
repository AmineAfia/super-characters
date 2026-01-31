"use client"

import { useState, useEffect, useRef, useCallback } from 'react'

interface TranscriptionMessage {
  id: string
  text: string
  timestamp: number
}

export function useTranscription() {
  const [isRecording, setIsRecording] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [messages, setMessages] = useState<TranscriptionMessage[]>([])
  const [audioLevel, setAudioLevel] = useState(0)
  
  const lastSegmentRef = useRef('')
  const messageIdRef = useRef(0)

  useEffect(() => {
    let unsubscribeSegment: (() => void) | null = null
    let unsubscribeComplete: (() => void) | null = null
    let unsubscribeShow: (() => void) | null = null
    let unsubscribeHide: (() => void) | null = null
    let unsubscribeReady: (() => void) | null = null
    let unsubscribeNotReady: (() => void) | null = null
    let unsubscribeAudioLevel: (() => void) | null = null

    const setupListeners = async () => {
      try {
        const { Events } = await import("@wailsio/runtime")

        // Listen for transcription segments (partial results)
        unsubscribeSegment = Events.On('transcription-segment', (event: any) => {
          const text = event?.data?.text
          if (text) {
            const cleanText = text.trim()
            if (cleanText && cleanText !== lastSegmentRef.current) {
              setCurrentTranscript(prev => prev + text + ' ')
              lastSegmentRef.current = cleanText
            }
          }
        })

        // Listen for complete transcription
        unsubscribeComplete = Events.On('transcription-complete', (event: any) => {
          const text = event?.data?.text
          if (text) {
            // Add as a new message
            const newMessage: TranscriptionMessage = {
              id: `msg-${++messageIdRef.current}`,
              text: text.trim(),
              timestamp: Date.now(),
            }
            setMessages(prev => [...prev, newMessage])
            setCurrentTranscript('')
            lastSegmentRef.current = ''
          }
        })

        // Listen for recording state
        unsubscribeShow = Events.On('overlay:show', (event: any) => {
          const state = event?.data?.state
          if (state === 'recording') {
            setIsRecording(true)
            setCurrentTranscript('')
            lastSegmentRef.current = ''
          }
        })

        unsubscribeHide = Events.On('overlay:hide', () => {
          setIsRecording(false)
        })

        // Listen for service ready state
        unsubscribeReady = Events.On('transcription:ready', () => {
          setIsReady(true)
        })

        unsubscribeNotReady = Events.On('transcription:not-ready', () => {
          setIsReady(false)
        })

        // Listen for audio levels
        unsubscribeAudioLevel = Events.On('audio:level', (event: any) => {
          const level = event?.data?.level
          if (typeof level === 'number') {
            setAudioLevel(prev => prev * 0.3 + level * 0.7)
          }
        })

        // Check initial ready state
        try {
          const { IsReady } = await import("../bindings/super-characters/app")
          const ready = await IsReady()
          setIsReady(ready)
        } catch (e) {
          console.log('Could not check IsReady:', e)
        }

      } catch (err) {
        console.error('Failed to set up event listeners:', err)
      }
    }

    setupListeners()

    return () => {
      unsubscribeSegment?.()
      unsubscribeComplete?.()
      unsubscribeShow?.()
      unsubscribeHide?.()
      unsubscribeReady?.()
      unsubscribeNotReady?.()
      unsubscribeAudioLevel?.()
    }
  }, [])

  const startTranscription = useCallback(async () => {
    try {
      const { StartTranscription } = await import("../bindings/super-characters/app")
      await StartTranscription('en')
    } catch (e) {
      console.error('Failed to start transcription:', e)
    }
  }, [])

  const stopTranscription = useCallback(async () => {
    try {
      const { StopTranscription } = await import("../bindings/super-characters/app")
      await StopTranscription()
    } catch (e) {
      console.error('Failed to stop transcription:', e)
    }
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setCurrentTranscript('')
  }, [])

  return {
    isRecording,
    isReady,
    currentTranscript,
    messages,
    audioLevel,
    startTranscription,
    stopTranscription,
    clearMessages,
  }
}
