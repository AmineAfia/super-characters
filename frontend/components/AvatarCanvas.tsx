"use client"

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react'

// TalkingHead is a browser-only ES module; we'll load it dynamically
let TalkingHeadClass: any = null
let LipsyncEnClass: any = null

export interface AvatarCanvasHandle {
  /**
   * Speak audio with lip-sync.
   * Pass raw WAV bytes (ArrayBuffer) and the spoken text for word-timing.
   * The audio is decoded using TalkingHead's own AudioContext for compatibility.
   */
  speakAudio: (wavArrayBuffer: ArrayBuffer, text?: string) => Promise<void>
  /** Set avatar mood (e.g. 'neutral', 'happy', 'thinking') */
  setMood: (mood: string) => void
  /** Start the animation loop */
  start: () => void
  /** Stop the animation loop */
  stop: () => void
  /**
   * Resume the AudioContext. Must be called from a user gesture (click handler)
   * to satisfy WKWebView autoplay policy on macOS.
   */
  resumeAudio: () => Promise<void>
}

interface AvatarCanvasProps {
  avatarUrl?: string
  onLoaded?: () => void
  onError?: (error: string) => void
}

const DEFAULT_AVATAR_URL =
  'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png'

const AvatarCanvas = forwardRef<AvatarCanvasHandle, AvatarCanvasProps>(
  ({ avatarUrl, onLoaded, onError }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const headRef = useRef<any>(null)
    const loadedRef = useRef(false)
    const initializingRef = useRef(false)

    // Expose imperative methods to parent
    useImperativeHandle(ref, () => ({
      speakAudio: async (wavArrayBuffer: ArrayBuffer, text?: string) => {
        const head = headRef.current
        if (!head) {
          console.error('[AvatarCanvas] No TalkingHead instance available')
          return
        }

        // Ensure AudioContext is resumed (WKWebView suspends it until user gesture)
        const ctx = head.audioCtx
        if (ctx && ctx.state === 'suspended') {
          console.log('[AvatarCanvas] Resuming suspended AudioContext')
          await ctx.resume()
        }

        // Decode audio using TalkingHead's own AudioContext
        // This avoids cross-context AudioBuffer issues in WKWebView
        let audioBuffer: AudioBuffer
        try {
          audioBuffer = await ctx.decodeAudioData(wavArrayBuffer.slice(0))
        } catch (decodeErr) {
          console.error('[AvatarCanvas] Failed to decode audio:', decodeErr)
          // Fallback: try with a new AudioContext
          try {
            const fallbackCtx = new AudioContext({ sampleRate: 24000 })
            audioBuffer = await fallbackCtx.decodeAudioData(wavArrayBuffer.slice(0))
            // Play directly since TalkingHead's context failed
            const source = fallbackCtx.createBufferSource()
            source.buffer = audioBuffer
            source.connect(fallbackCtx.destination)
            source.start()
            console.log('[AvatarCanvas] Playing audio via fallback AudioContext')
            return
          } catch (fallbackErr) {
            console.error('[AvatarCanvas] Fallback audio decode also failed:', fallbackErr)
            return
          }
        }
        console.log('[AvatarCanvas] Decoded audio via primary path:', audioBuffer.duration, 'seconds,', audioBuffer.numberOfChannels, 'channels,', audioBuffer.sampleRate, 'Hz')

        // Verify lipsync processor is available
        if (!head.lipsync?.['en']) {
          console.warn('[AvatarCanvas] Lipsync module not available, attempting injection')
          if (LipsyncEnClass) {
            head.lipsync['en'] = new LipsyncEnClass()
            console.log('[AvatarCanvas] Lipsync module injected in speakAudio')
          } else {
            console.warn('[AvatarCanvas] No LipsyncEn class available, lip-sync will not work')
          }
        } else {
          console.log('[AvatarCanvas] Lipsync module confirmed ready')
        }

        // Build word-timing arrays from the response text.
        // TalkingHead maps words → visemes for lip-sync animation.
        const words: string[] = []
        const wtimes: number[] = []
        const wdurations: number[] = []

        if (text) {
          const splitWords = text.split(/\s+/).filter(Boolean)
          const durationMs = audioBuffer.duration * 1000
          if (splitWords.length > 0 && durationMs > 0) {
            const wordDuration = durationMs / splitWords.length
            for (let i = 0; i < splitWords.length; i++) {
              words.push(splitWords[i])
              wtimes.push(i * wordDuration)
              wdurations.push(wordDuration)
            }
          }
        }

        console.log('[AvatarCanvas] Calling speakAudio with', words.length, 'words, audioCtx state:', ctx?.state)
        try {
          head.speakAudio({
            audio: audioBuffer,
            words,
            wtimes,
            wdurations,
            markers: [],
            mtimes: [],
          }, { lipsyncLang: 'en' })
          console.log('[AvatarCanvas] speakAudio called successfully')
        } catch (speakErr) {
          console.error('[AvatarCanvas] speakAudio threw:', speakErr)
          // Fallback: play audio directly if TalkingHead fails
          try {
            const fallbackCtx = new AudioContext({ sampleRate: audioBuffer.sampleRate })
            const source = fallbackCtx.createBufferSource()
            source.buffer = audioBuffer
            source.connect(fallbackCtx.destination)
            source.start()
            console.log('[AvatarCanvas] Playing via fallback after speakAudio error')
          } catch (fbErr) {
            console.error('[AvatarCanvas] Fallback playback also failed:', fbErr)
          }
        }
      },

      setMood: (mood: string) => {
        if (headRef.current) {
          headRef.current.setMood(mood)
        }
      },
      start: () => {
        if (headRef.current) {
          headRef.current.start()
        }
      },
      stop: () => {
        if (headRef.current) {
          headRef.current.stop()
        }
      },
      resumeAudio: async () => {
        const head = headRef.current
        if (!head?.audioCtx) return
        if (head.audioCtx.state === 'suspended') {
          console.log('[AvatarCanvas] Resuming AudioContext from user gesture, state:', head.audioCtx.state)
          await head.audioCtx.resume()
          console.log('[AvatarCanvas] AudioContext state after resume:', head.audioCtx.state)
        }
      },
    }))

    const initAvatar = useCallback(async () => {
      // Prevent double initialization from React Strict Mode or re-renders
      if (!containerRef.current || loadedRef.current || initializingRef.current) return
      initializingRef.current = true

      try {
        // Dynamically import TalkingHead and its lipsync module (browser-only).
        // We import lipsync-en explicitly because TalkingHead's internal
        // dynamic import('./lipsync-en.mjs') uses a relative path that fails
        // silently in Next.js's bundler.
        if (!TalkingHeadClass) {
          const [headModule, lipsyncModule] = await Promise.all([
            import('@met4citizen/talkinghead'),
            import('@met4citizen/talkinghead/modules/lipsync-en.mjs'),
          ])
          TalkingHeadClass = headModule.TalkingHead || headModule.default
          LipsyncEnClass = lipsyncModule.LipsyncEn
        }

        const head = new TalkingHeadClass(containerRef.current, {
          ttsEndpoint: 'N/A', // We handle TTS server-side
          lipsyncModules: [], // Empty: we inject lipsync-en manually below
          cameraView: 'upper',
          mixerGainSpeech: 2,
        })

        const url = avatarUrl || DEFAULT_AVATAR_URL

        await head.showAvatar(
          {
            url,
            body: 'F',
            avatarMood: 'neutral',
            lipsyncLang: 'en',
          },
          (ev: ProgressEvent) => {
            if (ev.lengthComputable) {
              const pct = Math.round((ev.loaded / ev.total) * 100)
              console.log(`[Avatar] Loading ${pct}%`)
            }
          }
        )

        // Inject lipsync processor directly. TalkingHead's internal
        // import('./lipsync-en.mjs') fails in Next.js bundler, so we
        // provide the module ourselves.
        if (LipsyncEnClass && !head.lipsync?.['en']) {
          head.lipsync['en'] = new LipsyncEnClass()
          console.log('[AvatarCanvas] Lipsync module injected successfully')
        } else if (head.lipsync?.['en']) {
          console.log('[AvatarCanvas] Lipsync module loaded natively')
        } else {
          console.warn('[AvatarCanvas] LipsyncEn class not available, lip-sync will not work')
        }

        headRef.current = head
        loadedRef.current = true
        onLoaded?.()
      } catch (err: any) {
        console.error('[Avatar] Failed to load:', err)
        initializingRef.current = false
        onError?.(err?.message || 'Failed to load avatar')
      }
    }, [avatarUrl, onLoaded, onError])

    useEffect(() => {
      initAvatar()

      // Pause/resume on visibility change
      const handleVisibility = () => {
        if (headRef.current) {
          if (document.visibilityState === 'visible') {
            headRef.current.start()
          } else {
            headRef.current.stop()
          }
        }
      }
      document.addEventListener('visibilitychange', handleVisibility)

      return () => {
        document.removeEventListener('visibilitychange', handleVisibility)
      }
    }, [initAvatar])

    return (
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: '300px' }}
      />
    )
  }
)

AvatarCanvas.displayName = 'AvatarCanvas'

export default AvatarCanvas
