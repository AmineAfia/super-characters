declare module '@met4citizen/talkinghead' {
  export class TalkingHead {
    audioCtx: AudioContext

    constructor(
      container: HTMLElement,
      options?: {
        ttsEndpoint?: string
        lipsyncModules?: string[]
        cameraView?: string
        mixerGainSpeech?: number
      }
    )

    showAvatar(
      config: {
        url: string
        body?: string
        avatarMood?: string
        lipsyncLang?: string
        ttsLang?: string
        ttsVoice?: string
      },
      onProgress?: (ev: ProgressEvent) => void
    ): Promise<void>

    speakAudio(
      audio: {
        audio: AudioBuffer
        words?: string[]
        wtimes?: number[]
        wdurations?: number[]
        markers?: (() => void)[]
        mtimes?: number[]
      },
      options?: {
        lipsyncLang?: string
      }
    ): void

    streamAudio(data: {
      audio: ArrayBuffer | Int16Array
      visemes?: string[]
      vtimes?: number[]
      vdurations?: number[]
      words?: string[]
      wtimes?: number[]
      wdurations?: number[]
    }): void

    speakText(text: string): void
    setMood(mood: string): void
    start(): void
    stop(): void
    lookAtCamera(duration?: number): void
    speakWithHands(): void

    lipsync: Record<string, any>
  }
}

declare module '@met4citizen/talkinghead/modules/lipsync-en.mjs' {
  export class LipsyncEn {
    constructor()
    preProcessText(s: string): string
    wordsToVisemes(word: string): any
  }
}
