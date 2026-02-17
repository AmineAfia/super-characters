"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  Upload,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Wand2,
  AlertCircle,
} from "lucide-react"
import type { Character } from "@/components/CharacterCard"

// Preset color palette (Apple system colors)
const COLOR_PRESETS = [
  { name: "Blue", value: "#007AFF" },
  { name: "Purple", value: "#BF5AF2" },
  { name: "Pink", value: "#FF2D55" },
  { name: "Red", value: "#FF3B30" },
  { name: "Orange", value: "#FF9500" },
  { name: "Yellow", value: "#FFCC00" },
  { name: "Green", value: "#30D158" },
  { name: "Teal", value: "#5AC8FA" },
  { name: "Indigo", value: "#5856D6" },
  { name: "Mint", value: "#00C7BE" },
]

// Voice presets (ElevenLabs voices)
const VOICE_PRESETS = ["Rachel", "Antoni", "Elli", "Adam", "Josh", "Sam", "Bella", "Domi"]

interface CreateCharacterModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCharacterCreated: (character: Character) => void
}

type CreationStep = "details" | "image" | "review"

export default function CreateCharacterModal({
  open,
  onOpenChange,
  onCharacterCreated,
}: CreateCharacterModalProps) {
  const [step, setStep] = useState<CreationStep>("details")
  const [isCreating, setIsCreating] = useState(false)
  const [isPipelineAvailable, setIsPipelineAvailable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Character details
  const [name, setName] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [description, setDescription] = useState("")
  const [voice, setVoice] = useState("Rachel")
  const [color, setColor] = useState("#007AFF")
  const [systemPrompt, setSystemPrompt] = useState("")

  // Image upload
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check if pipeline is available
  useEffect(() => {
    async function check() {
      try {
        const { IsPipelineAvailable } = await import("@/bindings/super-characters/app")
        const available = await IsPipelineAvailable()
        setIsPipelineAvailable(available)
      } catch {
        setIsPipelineAvailable(false)
      }
    }
    if (open) check()
  }, [open])

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setStep("details")
      setIsCreating(false)
      setError(null)
      setName("")
      setSubtitle("")
      setDescription("")
      setVoice("Rachel")
      setColor("#007AFF")
      setSystemPrompt("")
      setImageFile(null)
      setImagePreview(null)
      setImageBase64(null)
    }
  }, [open])

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImageFile(file)

    // Create preview URL
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setImagePreview(result)
      // Extract base64 data (remove data:image/...;base64, prefix)
      const base64 = result.split(",")[1]
      setImageBase64(base64)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith("image/")) {
      const input = fileInputRef.current
      if (input) {
        const dt = new DataTransfer()
        dt.items.add(file)
        input.files = dt.files
        handleImageSelect({ target: input } as any)
      }
    }
  }, [handleImageSelect])

  const generateDefaultPrompt = useCallback(() => {
    if (!name) return
    const prompt = `You are ${name}${subtitle ? `, the ${subtitle}` : ""}. ${description || `You are a unique character with your own personality and perspective.`} You speak naturally and stay in character at all times.`
    setSystemPrompt(prompt)
  }, [name, subtitle, description])

  const canProceedToImage = name.trim().length > 0 && systemPrompt.trim().length > 0
  const canCreate = name.trim().length > 0 && systemPrompt.trim().length > 0

  const handleCreate = async () => {
    setIsCreating(true)
    setError(null)

    try {
      const { CreateCustomCharacter } = await import("@/bindings/super-characters/app")

      const result = await CreateCustomCharacter(
        name.trim(),
        subtitle.trim() || "Custom Character",
        voice,
        "Gemini Pro",
        description.trim(),
        color,
        systemPrompt.trim(),
        imageBase64 || "",
        imageFile?.name || "",
      )

      if (!result) {
        throw new Error("Failed to create character")
      }

      // Convert to Character type
      const character: Character = {
        id: result.id,
        name: result.name,
        subtitle: result.subtitle,
        voice: result.voice,
        model: result.model,
        avatarUrl: result.avatarUrl || "",
        thumbnailUrl: result.thumbnailUrl || "",
        description: result.description,
        color: result.color,
        systemPrompt: result.systemPrompt,
        isCustom: true,
        status: result.status,
      }

      // If pipeline is available and image was uploaded, start the pipeline
      if (isPipelineAvailable && imageBase64) {
        try {
          const { RunCharacterPipeline } = await import("@/bindings/super-characters/app")
          await RunCharacterPipeline(result.id)
        } catch (pipelineErr) {
          console.warn("[CreateCharacter] Pipeline start failed:", pipelineErr)
          // Non-fatal - character still works with default avatar
        }
      }

      onCharacterCreated(character)
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create character"
      setError(msg)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Character</DialogTitle>
          <DialogDescription>
            {step === "details" && "Define your character's personality and appearance."}
            {step === "image" && "Upload a photo to generate a 3D avatar."}
            {step === "review" && "Review and create your character."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-1">
          {(["details", "image", "review"] as CreationStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors duration-300",
                  step === s
                    ? "bg-primary"
                    : i < (["details", "image", "review"].indexOf(step))
                      ? "bg-primary/40"
                      : "bg-muted"
                )}
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step: Details */}
        {step === "details" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="char-name">Name</Label>
              <Input
                id="char-name"
                placeholder="e.g., Captain Zara"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="char-subtitle">Title / Subtitle</Label>
              <Input
                id="char-subtitle"
                placeholder="e.g., Space Explorer"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="char-description">Description</Label>
              <Input
                id="char-description"
                placeholder="A brief description of your character..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Voice</Label>
              <div className="flex flex-wrap gap-1.5">
                {VOICE_PRESETS.map((v) => (
                  <button
                    key={v}
                    onClick={() => setVoice(v)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                      voice === v
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setColor(c.value)}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-all duration-200",
                      color === c.value
                        ? "border-foreground scale-110 shadow-lg"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="char-prompt">System Prompt</Label>
                {name && (
                  <button
                    onClick={generateDefaultPrompt}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <Wand2 className="w-3 h-3" />
                    Auto-generate
                  </button>
                )}
              </div>
              <textarea
                id="char-prompt"
                className={cn(
                  "flex w-full px-4 py-2.5 text-sm",
                  "bg-input backdrop-blur-glass-light",
                  "border border-border rounded-xl",
                  "shadow-glass-inset",
                  "placeholder:text-muted-foreground",
                  "transition-all duration-200 ease-apple",
                  "focus-visible:outline-none focus-visible:border-primary",
                  "focus-visible:ring-2 focus-visible:ring-primary/20",
                  "resize-none min-h-[80px]"
                )}
                placeholder="Define your character's personality, speaking style, and knowledge areas..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Step: Image Upload */}
        {step === "image" && (
          <div className="space-y-4">
            <div
              className={cn(
                "relative border-2 border-dashed rounded-2xl p-8",
                "flex flex-col items-center justify-center gap-4",
                "transition-colors duration-200",
                imagePreview
                  ? "border-primary/30 bg-primary/5"
                  : "border-border hover:border-primary/30 hover:bg-muted/20"
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-48 h-48 object-cover rounded-2xl shadow-glass"
                  />
                  <button
                    onClick={() => {
                      setImageFile(null)
                      setImagePreview(null)
                      setImageBase64(null)
                      if (fileInputRef.current) fileInputRef.current.value = ""
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs hover:scale-110 transition-transform"
                  >
                    x
                  </button>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-full bg-muted/40">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Drop an image here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG up to 10MB
                    </p>
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleImageSelect}
              />
            </div>

            {isPipelineAvailable && imagePreview && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">3D Avatar Generation Available</p>
                  <p className="mt-0.5">
                    Your image will be transformed into a Nano Banana figurine
                    and converted to a 3D avatar using TripoSR.
                  </p>
                </div>
              </div>
            )}

            {!isPipelineAvailable && imagePreview && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
                <ImageIcon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Image as Thumbnail</p>
                  <p className="mt-0.5">
                    Your image will be used as the character thumbnail.
                    Install the Python ML pipeline (TripoSR, Stable Diffusion)
                    to enable automatic 3D avatar generation.
                  </p>
                </div>
              </div>
            )}

            <p className="text-xs text-center text-muted-foreground">
              Image upload is optional. Characters without images use the default avatar.
            </p>
          </div>
        )}

        {/* Step: Review */}
        {step === "review" && (
          <div className="space-y-4">
            {/* Character preview card */}
            <div
              className="relative rounded-2xl overflow-hidden border border-glass-border p-5"
              style={{
                background: `linear-gradient(135deg, ${color}15 0%, transparent 60%)`,
              }}
            >
              <div className="flex items-start gap-4">
                {/* Avatar preview */}
                <div
                  className="w-16 h-16 rounded-full border-2 flex-shrink-0 overflow-hidden flex items-center justify-center"
                  style={{ borderColor: color }}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-white font-bold text-xl"
                      style={{ backgroundColor: color }}
                    >
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold tracking-tight">{name || "Unnamed Character"}</h3>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
                    {subtitle || "Custom Character"}
                  </p>
                  {description && (
                    <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted/60">
                      {voice}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted/60">
                      Gemini Pro
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* System prompt preview */}
            <div className="glass-card rounded-xl p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                System Prompt
              </p>
              <p className="text-sm text-foreground/70 line-clamp-3">{systemPrompt}</p>
            </div>

            {imagePreview && isPipelineAvailable && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10 text-xs text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                3D avatar will be generated in the background after creation.
              </div>
            )}
          </div>
        )}

        {/* Footer navigation */}
        <DialogFooter>
          {step === "details" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep("image")}
                disabled={!canProceedToImage}
                style={{ backgroundColor: color, color: "#1C1C1E" }}
              >
                Next
              </Button>
            </>
          )}

          {step === "image" && (
            <>
              <Button variant="ghost" onClick={() => setStep("details")}>
                Back
              </Button>
              <Button
                onClick={() => setStep("review")}
                style={{ backgroundColor: color, color: "#1C1C1E" }}
              >
                {imagePreview ? "Next" : "Skip Image"}
              </Button>
            </>
          )}

          {step === "review" && (
            <>
              <Button variant="ghost" onClick={() => setStep("image")}>
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!canCreate || isCreating}
                style={{ backgroundColor: color, color: "#1C1C1E" }}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Create Character
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
