"use client"

import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Check, ExternalLink, Settings, Link2, Camera, User, Trash2, AlertTriangle } from "lucide-react"
import ComponentBrowser from "./ComponentBrowser"

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnectionChange?: () => void
}

type TabId = "general" | "avatar" | "apps"

export default function SettingsModal({ open, onOpenChange, onConnectionChange }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("general")
  const [geminiApiKey, setGeminiApiKey] = useState("")
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState("")
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState("")
  const [silenceDurationMs, setSilenceDurationMs] = useState(300)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Avatar state
  const [avatars, setAvatars] = useState<Array<{ id: string; path: string; thumbnail: string; createdAt: number }>>([])
  const [activeAvatarPath, setActiveAvatarPath] = useState("")
  const [isCapturing, setIsCapturing] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null)
  const [depsWarning, setDepsWarning] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Load current settings when modal opens
  useEffect(() => {
    if (open) {
      loadSettings()
      loadAvatars()
    } else {
      // Stop camera when modal closes
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      setIsCapturing(false)
      setCapturedPhoto(null)
    }
  }, [open])

  const loadSettings = async () => {
    try {
      const { GetSettings, GetSilenceDurationMs } = await import("@/bindings/super-characters/app")
      const settings = await GetSettings()
      setGeminiApiKey(settings.geminiApiKey || "")
      setElevenLabsApiKey(settings.elevenLabsApiKey || "")
      setElevenLabsVoiceId(settings.elevenLabsVoiceId || "")
      // Load silence duration separately (has default handling)
      const duration = await GetSilenceDurationMs()
      setSilenceDurationMs(duration || 300)

      // Sync Gemini API key to localStorage for frontend agent
      if (settings.geminiApiKey) {
        const { setGeminiApiKey: setLocalStorageKey } = await import("@/lib/agent/config")
        setLocalStorageKey(settings.geminiApiKey)
      }
    } catch (e) {
      console.error("Failed to load settings:", e)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveSuccess(false)

    try {
      const { SetGeminiAPIKey, SetElevenLabsAPIKey, SetElevenLabsVoiceID, SetSilenceDurationMs } = await import(
        "@/bindings/super-characters/app"
      )

      // Save each setting to Go backend
      await SetGeminiAPIKey(geminiApiKey)
      await SetElevenLabsAPIKey(elevenLabsApiKey)
      await SetElevenLabsVoiceID(elevenLabsVoiceId)
      await SetSilenceDurationMs(silenceDurationMs)

      // Also save Gemini API key to localStorage for frontend agent
      const { setGeminiApiKey: setLocalStorageKey } = await import("@/lib/agent/config")
      setLocalStorageKey(geminiApiKey)

      setSaveSuccess(true)
      setTimeout(() => {
        setSaveSuccess(false)
        onOpenChange(false)
      }, 1000)
    } catch (e) {
      console.error("Failed to save settings:", e)
    } finally {
      setIsSaving(false)
    }
  }

  const loadAvatars = async () => {
    try {
      const { GetCustomAvatars, GetActiveAvatarPath: GetActivePath, CheckAvatarDependencies } = await import("@/bindings/super-characters/app")
      const list = await GetCustomAvatars()
      setAvatars(list || [])
      const activePath = await GetActivePath()
      setActiveAvatarPath(activePath || "")
      const depCheck = await CheckAvatarDependencies()
      setDepsWarning(depCheck || null)
    } catch (e) {
      console.error("Failed to load avatars:", e)
    }
  }

  const startCamera = async () => {
    setAvatarError(null)
    setAvatarSuccess(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } })
      streamRef.current = stream
      setIsCapturing(true)
    } catch (e: any) {
      setAvatarError("Camera access denied: " + (e.message || "Unknown error"))
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current) return
    const canvas = document.createElement("canvas")
    canvas.width = videoRef.current.videoWidth || 640
    canvas.height = videoRef.current.videoHeight || 480
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(videoRef.current, 0, 0)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9)
    setCapturedPhoto(dataUrl)
    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setIsCapturing(false)
  }

  const generateAvatar = async () => {
    if (!capturedPhoto) return
    setIsGenerating(true)
    setAvatarError(null)
    setAvatarSuccess(null)
    try {
      const { GenerateAvatarFromPhoto } = await import("@/bindings/super-characters/app")
      // Strip data URL prefix to get pure base64
      const base64 = capturedPhoto.split(",")[1]
      const result = await GenerateAvatarFromPhoto(base64)
      if (result) {
        setCapturedPhoto(null)
        await loadAvatars()
        // Auto-select the newly generated avatar
        await selectAvatar(result.id)
        setAvatarSuccess("Avatar created and selected! Close settings to apply.")
      }
    } catch (e: any) {
      setAvatarError("Generation failed: " + (e.message || "Unknown error"))
    } finally {
      setIsGenerating(false)
    }
  }

  const selectAvatar = async (avatarId: string) => {
    try {
      const { SetActiveAvatar, GetActiveAvatarPath: GetActivePath } = await import("@/bindings/super-characters/app")
      await SetActiveAvatar(avatarId)
      const path = await GetActivePath()
      setActiveAvatarPath(path || "")
    } catch (e) {
      console.error("Failed to set avatar:", e)
    }
  }

  const resetToDefault = async () => {
    try {
      const { SetActiveAvatar } = await import("@/bindings/super-characters/app")
      await SetActiveAvatar("")
      setActiveAvatarPath("")
    } catch (e) {
      console.error("Failed to reset avatar:", e)
    }
  }

  const deleteAvatar = async (avatarId: string) => {
    try {
      const { DeleteCustomAvatar } = await import("@/bindings/super-characters/app")
      await DeleteCustomAvatar(avatarId)
      await loadAvatars()
    } catch (e) {
      console.error("Failed to delete avatar:", e)
    }
  }

  const tabs = [
    { id: "general" as const, label: "General", icon: Settings },
    { id: "avatar" as const, label: "Avatar", icon: User },
    { id: "apps" as const, label: "Connected Apps", icon: Link2 },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your API keys and app integrations.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex border-b border-border -mx-6 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto py-4 -mx-6 px-6">
          {activeTab === "general" && (
            <div className="grid gap-4">
              {/* Gemini API Key */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="gemini-key">Gemini API Key</Label>
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    Get API Key <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Input
                  id="gemini-key"
                  type="password"
                  placeholder="Enter your Gemini API key"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Required for AI conversations
                </p>
              </div>

              {/* ElevenLabs API Key */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="elevenlabs-key">ElevenLabs API Key</Label>
                  <a
                    href="https://elevenlabs.io/app/settings/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    Get API Key <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Input
                  id="elevenlabs-key"
                  type="password"
                  placeholder="Enter your ElevenLabs API key"
                  value={elevenLabsApiKey}
                  onChange={(e) => setElevenLabsApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Required for voice synthesis
                </p>
              </div>

              {/* ElevenLabs Voice ID */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="voice-id">ElevenLabs Voice ID</Label>
                  <a
                    href="https://elevenlabs.io/app/voice-library"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    Browse Voices <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Input
                  id="voice-id"
                  type="text"
                  placeholder="21m00Tcm4TlvDq8ikWAM (Rachel)"
                  value={elevenLabsVoiceId}
                  onChange={(e) => setElevenLabsVoiceId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Optional - defaults to Rachel if not set
                </p>
              </div>

              {/* Silence Duration */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="silence-duration">Silence Duration</Label>
                  <span className="text-xs text-muted-foreground">{silenceDurationMs}ms</span>
                </div>
                <Input
                  id="silence-duration"
                  type="range"
                  min="100"
                  max="1000"
                  step="50"
                  value={silenceDurationMs}
                  onChange={(e) => setSilenceDurationMs(parseInt(e.target.value))}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  How long to wait after you stop speaking before processing (100-1000ms)
                </p>
              </div>
            </div>
          )}

          {activeTab === "avatar" && (
            <div className="grid gap-4">
              {/* Dependency warning */}
              {depsWarning && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-500">Python dependencies missing</p>
                    <p className="text-xs text-muted-foreground mt-1">{depsWarning}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">Install with:</p>
                    <code className="text-xs text-muted-foreground block mt-0.5 bg-black/20 rounded px-2 py-1 select-all">pip3 install mediapipe opencv-python numpy Pillow pygltflib</code>
                  </div>
                </div>
              )}

              {/* Camera capture */}
              {!capturedPhoto && !isCapturing && (
                <div className="flex flex-col items-center gap-3 p-6 border border-dashed border-border rounded-lg">
                  <Camera className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Take a photo to generate your avatar</p>
                  <Button onClick={startCamera} disabled={!!depsWarning}>
                    <Camera className="mr-2 h-4 w-4" />
                    Open Camera
                  </Button>
                </div>
              )}

              {/* Camera preview */}
              {isCapturing && (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-full max-w-[320px] aspect-[4/3] rounded-lg overflow-hidden bg-black">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      ref={(el) => {
                        videoRef.current = el
                        if (el && streamRef.current) {
                          el.srcObject = streamRef.current
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      webkit-playsinline="true"
                      className="w-full h-full object-cover"
                      style={{ WebkitTransform: "scaleX(-1)", transform: "scaleX(-1)" }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => {
                      if (streamRef.current) {
                        streamRef.current.getTracks().forEach(t => t.stop())
                        streamRef.current = null
                      }
                      setIsCapturing(false)
                    }}>
                      Cancel
                    </Button>
                    <Button onClick={capturePhoto}>
                      <Camera className="mr-2 h-4 w-4" />
                      Capture
                    </Button>
                  </div>
                </div>
              )}

              {/* Captured photo preview */}
              {capturedPhoto && (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-border">
                    <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setCapturedPhoto(null)}>
                      Retake
                    </Button>
                    <Button onClick={generateAvatar} disabled={isGenerating}>
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        "Generate Avatar"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Error */}
              {avatarError && (
                <p className="text-sm text-destructive text-center">{avatarError}</p>
              )}

              {/* Success */}
              {avatarSuccess && (
                <p className="text-sm text-green-500 text-center">{avatarSuccess}</p>
              )}

              {/* Saved avatars gallery */}
              {avatars.length > 0 && (
                <div className="grid gap-2">
                  <Label>Your Avatars</Label>
                  <div className="grid grid-cols-4 gap-3">
                    {/* Default avatar option */}
                    <button
                      onClick={resetToDefault}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors ${
                        !activeAvatarPath
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <span className="text-[10px] text-muted-foreground">Default</span>
                    </button>

                    {avatars.map((av) => (
                      <div key={av.id} className="relative group">
                        <button
                          onClick={() => selectAvatar(av.id)}
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors w-full ${
                            activeAvatarPath === av.path
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-muted-foreground"
                          }`}
                        >
                          <div className="w-14 h-14 rounded-full overflow-hidden bg-muted">
                            {av.thumbnail ? (
                              <img
                                src={`data:image/png;base64,${av.thumbnail}`}
                                alt="Avatar"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <User className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(av.createdAt * 1000).toLocaleDateString()}
                          </span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteAvatar(av.id) }}
                          className="absolute -top-1 -right-1 p-1 rounded-full bg-destructive/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {activeAvatarPath && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Custom avatar active. Close settings to see it on the main page.
                    </p>
                  )}
                </div>
              )}

              {avatars.length === 0 && !capturedPhoto && !isCapturing && (
                <p className="text-xs text-muted-foreground text-center">
                  No custom avatars yet. Take a photo to create one.
                </p>
              )}
            </div>
          )}

          {activeTab === "apps" && (
            <ComponentBrowser onConnectionChange={onConnectionChange} />
          )}
        </div>

        {/* Footer - show for general tab */}
        {activeTab === "general" && (
          <DialogFooter className="border-t border-border pt-4 -mx-6 px-6">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Saved!
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
