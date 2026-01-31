"use client"

import { useState, useEffect } from "react"
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
import { Loader2, Check, ExternalLink, Settings, Link2 } from "lucide-react"
import ComponentBrowser from "./ComponentBrowser"

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnectionChange?: () => void
}

type TabId = "general" | "apps"

export default function SettingsModal({ open, onOpenChange, onConnectionChange }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("general")
  const [geminiApiKey, setGeminiApiKey] = useState("")
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState("")
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState("")
  const [silenceDurationMs, setSilenceDurationMs] = useState(300)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Load current settings when modal opens
  useEffect(() => {
    if (open) {
      loadSettings()
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

  const tabs = [
    { id: "general" as const, label: "General", icon: Settings },
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

          {activeTab === "apps" && (
            <ComponentBrowser onConnectionChange={onConnectionChange} />
          )}
        </div>

        {/* Footer - only show for general tab */}
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
