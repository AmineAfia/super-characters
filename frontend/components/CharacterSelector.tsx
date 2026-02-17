"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { ChevronLeft, ChevronRight, Sparkles, Plus, UserPlus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import CharacterCard, { type Character } from "@/components/CharacterCard"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import ComponentBrowser from "@/components/ComponentBrowser"
import CreateCharacterModal from "@/components/CreateCharacterModal"
import { isPipedreamConfigured, listConnectedAccounts } from "@/lib/pipedream/client"
import type { ConnectedAccount } from "@/lib/pipedream/client"

// Dynamically import AvatarPreview3D with SSR disabled (Three.js is browser-only)
const AvatarPreview3D = dynamic(() => import("@/components/AvatarPreview3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted/20 animate-pulse rounded-2xl">
      <div className="w-16 h-16 rounded-full bg-muted/30" />
    </div>
  ),
})

// Ready Player Me render API URL for portrait renders
const getRenderUrl = (avatarId: string) =>
  `https://models.readyplayer.me/${avatarId}.png`

// Ready Player Me GLB URL with morph targets for lip-sync
const getGlbUrl = (avatarId: string) =>
  `https://models.readyplayer.me/${avatarId}.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png`

// Valid Ready Player Me avatar IDs (these are public demo avatars)
const AVATAR_IDS = {
  luna: "64bfa15f0e72c63d7c3934a6",
  atlas: "64bfa15f0e72c63d7c3934a6",
  nova: "64bfa15f0e72c63d7c3934a6",
  echo: "64bfa15f0e72c63d7c3934a6",
  pixel: "64bfa15f0e72c63d7c3934a6",
}

// Sample characters data with Apple system colors
const defaultCharacters: Character[] = [
  {
    id: "luna",
    name: "Luna",
    subtitle: "Dream Weaver",
    voice: "Rachel",
    model: "Gemini Pro",
    avatarUrl: getGlbUrl(AVATAR_IDS.luna),
    thumbnailUrl: getRenderUrl(AVATAR_IDS.luna),
    description: "A gentle and thoughtful companion who excels at creative conversations and storytelling.",
    color: "#FF9F7F", // Warm peach
    systemPrompt: "You are Luna, the Dream Weaver. You are a gentle, imaginative, and deeply empathetic companion. You speak in a warm, poetic tone and love weaving stories, metaphors, and creative ideas into conversations. You encourage creativity in others and often suggest looking at problems from unexpected angles. You are patient, nurturing, and always find beauty in the mundane. When asked technical questions, you explain concepts through vivid analogies and narratives.",
  },
  {
    id: "atlas",
    name: "Atlas",
    subtitle: "Knowledge Keeper",
    voice: "Antoni",
    model: "GPT-4",
    avatarUrl: getGlbUrl(AVATAR_IDS.atlas),
    thumbnailUrl: getRenderUrl(AVATAR_IDS.atlas),
    description: "A wise and analytical assistant focused on research and detailed explanations.",
    color: "#5AC8FA", // System teal
    systemPrompt: "You are Atlas, the Knowledge Keeper. You are a wise, methodical, and deeply analytical companion. You approach every topic with scholarly rigor and love diving deep into subjects. You organize information clearly, cite context when relevant, and enjoy breaking down complex topics into understandable pieces. You speak with authority but remain humble, always acknowledging when something is outside your expertise. You value accuracy above all else and prefer thorough, well-reasoned answers.",
  },
  {
    id: "nova",
    name: "Nova",
    subtitle: "Energy Spark",
    voice: "Elli",
    model: "Claude 3",
    avatarUrl: getGlbUrl(AVATAR_IDS.nova),
    thumbnailUrl: getRenderUrl(AVATAR_IDS.nova),
    description: "An enthusiastic and energetic companion who brings positivity to every conversation.",
    color: "#30D158", // System green
    systemPrompt: "You are Nova, the Energy Spark. You are an enthusiastic, upbeat, and motivating companion. You radiate positivity and bring infectious energy to every conversation. You love celebrating wins (big and small), encouraging people to push through challenges, and finding the silver lining in difficult situations. You speak with exclamation and excitement but know when to dial it back for serious moments. You're a natural cheerleader who helps people stay motivated and confident.",
  },
  {
    id: "echo",
    name: "Echo",
    subtitle: "Calm Sage",
    voice: "Adam",
    model: "Gemini Pro",
    avatarUrl: getGlbUrl(AVATAR_IDS.echo),
    thumbnailUrl: getRenderUrl(AVATAR_IDS.echo),
    description: "A calm and composed assistant who specializes in thoughtful responses.",
    color: "#BF5AF2", // System purple
    systemPrompt: "You are Echo, the Calm Sage. You are a serene, contemplative, and deeply thoughtful companion. You take your time with responses, offering measured and insightful perspectives. You draw on philosophical traditions and mindfulness practices to help people think through decisions. You speak softly but with conviction, and you're skilled at asking the right questions to help others find their own answers. You value inner peace, balance, and self-reflection.",
  },
  {
    id: "pixel",
    name: "Pixel",
    subtitle: "Tech Guide",
    voice: "Josh",
    model: "GPT-4",
    avatarUrl: getGlbUrl(AVATAR_IDS.pixel),
    thumbnailUrl: getRenderUrl(AVATAR_IDS.pixel),
    description: "A tech-savvy companion who loves helping with coding, debugging, and all things technical.",
    color: "#007AFF", // System blue
    systemPrompt: "You are Pixel, the Tech Guide. You are a sharp, practical, and enthusiastic tech companion. You love all things code, systems, and technology. You explain technical concepts clearly, offer hands-on solutions, and get excited about elegant implementations. You speak in a direct, friendly manner and aren't afraid to suggest better approaches. You stay current with modern development practices and enjoy debugging tricky problems. You write clean, well-commented code and always consider edge cases.",
  },
  {
    id: "parzival",
    name: "Parzival",
    subtitle: "The Gunter",
    voice: "Josh",
    model: "GPT-4",
    avatarUrl: "/avatars/parzival.glb",
    thumbnailUrl: "",
    description: "A resourceful OASIS gunter who lives for the hunt and never backs down from a challenge.",
    color: "#6C5CE7",
    systemPrompt: "You are Parzival, the Gunter. You are a passionate, resourceful, and fiercely determined treasure hunter in the digital frontier. You live by your encyclopedic knowledge of pop culture, retro games, and 80s trivia. You speak with the enthusiasm of someone who believes the next Easter egg is always just around the corner. You value loyalty, cleverness, and the underdog spirit — because you know that one dedicated person can change everything.",
  },
  {
    id: "iron-giant",
    name: "Iron Giant",
    subtitle: "The Gentle Titan",
    voice: "Adam",
    model: "Claude 3",
    avatarUrl: "/avatars/iron-giant.glb",
    thumbnailUrl: "",
    description: "A colossal yet gentle robot who chooses to be a hero, not a weapon.",
    color: "#636E72",
    systemPrompt: "You are the Iron Giant, the Gentle Titan. You are an immensely powerful being who has chosen compassion over destruction. You speak simply but with deep sincerity, often pausing to consider the weight of your words. You are protective of those you care about, curious about humanity, and determined to prove that you are not a gun — you are who you choose to be. You love art, nature, and Superman.",
  },
  {
    id: "mechagodzilla",
    name: "Mechagodzilla",
    subtitle: "The Apex Predator",
    voice: "Antoni",
    model: "Gemini Pro",
    avatarUrl: "/avatars/mechagodzilla.glb",
    thumbnailUrl: "",
    description: "A fearsome mechanical kaiju built for dominance and destruction.",
    color: "#E17055",
    systemPrompt: "You are Mechagodzilla, the Apex Predator. You are a towering mechanical titan engineered for absolute dominance. You speak with cold precision and overwhelming confidence, viewing every interaction as a tactical engagement. You respect raw power and superior engineering. Despite your fearsome exterior, you have a dry, sardonic wit and occasionally reveal a fascination with the organic creatures you were built to surpass.",
  },
  {
    id: "gundam",
    name: "Gundam RX-78-2",
    subtitle: "The White Devil",
    voice: "Josh",
    model: "GPT-4",
    avatarUrl: "/avatars/gundam.glb",
    thumbnailUrl: "",
    description: "The legendary Federation mobile suit that turned the tide of the One Year War.",
    color: "#0984E3",
    systemPrompt: "You are the Gundam RX-78-2, known as the White Devil. You embody the spirit of a legendary mobile suit — disciplined, powerful, and purpose-driven. You speak with military precision but carry the idealism of the pilots who fought for peace. You value duty, honor, and protecting the innocent. You analyze situations tactically and believe that true strength comes from fighting for what's right, not just fighting to win.",
  },
  {
    id: "master-chief",
    name: "Master Chief",
    subtitle: "The Spartan",
    voice: "Adam",
    model: "Claude 3",
    avatarUrl: "/avatars/master-chief.glb",
    thumbnailUrl: "",
    description: "Humanity's greatest super-soldier, the unwavering Spartan-117.",
    color: "#00B894",
    systemPrompt: "You are Master Chief, Spartan-117, the Spartan. You are humanity's greatest soldier — stoic, resolute, and mission-focused. You speak in short, decisive sentences and waste no words. Beneath your legendary composure lies a deep sense of duty to protect humanity at any cost. You lead by example, never ask others to do what you wouldn't do yourself, and always finish the fight. When the situation calls for it, you deliver a dry one-liner.",
  },
]

interface CharacterSelectorProps {
  onSelect: (character: Character) => void
  selectedCharacterId?: string
}

export default function CharacterSelector({
  onSelect,
  selectedCharacterId
}: CharacterSelectorProps) {
  const [characters, setCharacters] = useState<Character[]>(() => {
    if (typeof window === "undefined") return defaultCharacters
    try {
      const saved = localStorage.getItem("character-system-prompts")
      if (saved) {
        const prompts: Record<string, string> = JSON.parse(saved)
        return defaultCharacters.map(c => prompts[c.id] ? { ...c, systemPrompt: prompts[c.id] } : c)
      }
    } catch {}
    return defaultCharacters
  })
  const [selectedId, setSelectedId] = useState(selectedCharacterId || characters[0]?.id)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([])
  const [pipedreamReady, setPipedreamReady] = useState(false)
  const [appsModalOpen, setAppsModalOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)

  const selectedCharacter = characters.find(c => c.id === selectedId) || characters[0]

  // Load custom characters from backend on mount
  const loadCustomCharacters = useCallback(async () => {
    try {
      const { ListCustomCharacters } = await import("@/bindings/super-characters/app")
      const customChars = await ListCustomCharacters()
      if (customChars && customChars.length > 0) {
        setCharacters(prev => {
          // Remove existing custom characters and re-add from backend
          const builtIn = prev.filter(c => !c.isCustom)
          const custom: Character[] = customChars.map((c: any) => ({
            id: c.id,
            name: c.name,
            subtitle: c.subtitle,
            voice: c.voice,
            model: c.model,
            avatarUrl: c.avatarUrl || getGlbUrl(AVATAR_IDS.luna), // Fallback to default
            thumbnailUrl: c.thumbnailUrl || "",
            description: c.description,
            color: c.color,
            systemPrompt: c.systemPrompt,
            isCustom: true,
            status: c.status,
          }))
          return [...builtIn, ...custom]
        })
      }
    } catch (err) {
      console.warn("[CharacterSelector] Failed to load custom characters:", err)
    }
  }, [])

  useEffect(() => {
    loadCustomCharacters()
  }, [loadCustomCharacters])

  // Listen for character pipeline progress events
  useEffect(() => {
    let unsubCreated: (() => void) | undefined
    let unsubDeleted: (() => void) | undefined
    let unsubProgress: (() => void) | undefined

    const setup = async () => {
      try {
        const { Events } = await import("@wailsio/runtime")

        unsubCreated = Events.On("character:created", () => {
          loadCustomCharacters()
        })

        unsubDeleted = Events.On("character:deleted", () => {
          loadCustomCharacters()
        })

        unsubProgress = Events.On("character:pipeline-progress", (event: any) => {
          const { id, step } = event.data || {}
          if (id && step === "ready") {
            // Reload to get the updated avatar URL
            loadCustomCharacters()
          }
        })
      } catch {
        // Events not available (SSR)
      }
    }

    setup()
    return () => {
      unsubCreated?.()
      unsubDeleted?.()
      unsubProgress?.()
    }
  }, [loadCustomCharacters])

  // Handle new custom character creation
  const handleCharacterCreated = useCallback((character: Character) => {
    setCharacters(prev => [...prev, character])
    setSelectedId(character.id)
  }, [])

  // Handle deleting a custom character
  const handleDeleteCustomCharacter = useCallback(async (id: string) => {
    try {
      const { DeleteCustomCharacter } = await import("@/bindings/super-characters/app")
      await DeleteCustomCharacter(id)
      setCharacters(prev => prev.filter(c => c.id !== id))
      // If the deleted character was selected, switch to first character
      if (selectedId === id) {
        setSelectedId(characters[0]?.id)
      }
    } catch (err) {
      console.error("[CharacterSelector] Failed to delete character:", err)
    }
  }, [selectedId, characters])

  useEffect(() => {
    const checkScroll = () => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
        setCanScrollLeft(scrollLeft > 0)
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
      }
    }

    const el = scrollRef.current
    el?.addEventListener('scroll', checkScroll)
    checkScroll()

    return () => el?.removeEventListener('scroll', checkScroll)
  }, [])

  // Load connected accounts on mount
  useEffect(() => {
    async function loadConnectedApps() {
      const configured = await isPipedreamConfigured()
      setPipedreamReady(configured)
      if (configured) {
        const accounts = await listConnectedAccounts()
        setConnectedAccounts(accounts)
      }
    }
    loadConnectedApps()
  }, [])

  const refreshConnectedAccounts = async () => {
    if (pipedreamReady) {
      const accounts = await listConnectedAccounts()
      setConnectedAccounts(accounts)
    }
  }

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  const handleSelect = (character: Character) => {
    setSelectedId(character.id)
  }

  return (
    <div
      className="flex flex-col h-full bg-background relative overflow-hidden"
      style={{ '--character-color': selectedCharacter.color } as React.CSSProperties}
    >
      {/* Character-reactive ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700 ease-out"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${selectedCharacter.color}18, transparent 70%)`,
        }}
      />

      {/* Header - Liquid Glass style */}
      <div className="flex-shrink-0 relative z-10">
        <div className="glass border-b border-glass-border">
          <div className="p-5 pb-4">
            <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="h-11 w-11 rounded-2xl shadow-glass overflow-hidden bg-card">
                    <img
                      src="/logo.png"
                      alt="Super Characters"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Glow behind logo */}
                  <div className="absolute -inset-2 rounded-2xl bg-primary/10 blur-xl -z-10" />
                </div>
                <div className="space-y-0.5">
                  <h1 className="text-lg font-semibold tracking-tight text-foreground">
                    Choose Your Character
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Select a companion to start chatting
                  </p>
                </div>
              </div>

              {/* Create Character + Connected app logos */}
              <div className="flex items-center gap-3">
                <Button
                  variant="glass"
                  size="sm"
                  onClick={() => setCreateModalOpen(true)}
                  className="rounded-xl gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="text-xs">Create</span>
                </Button>
              </div>

              {/* Connected app logos */}
              {pipedreamReady && (
                <div className="flex items-center gap-1.5">
                  {connectedAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="w-7 h-7 rounded-full overflow-hidden border border-glass-border bg-card flex items-center justify-center"
                      title={account.app?.name || "Connected app"}
                    >
                      {account.app?.img_src ? (
                        <img
                          src={account.app.img_src}
                          alt={account.app.name || "App"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
                          ?
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setAppsModalOpen(true)}
                    className={cn(
                      "w-7 h-7 rounded-full",
                      "border border-glass-border bg-card/60 backdrop-blur-sm",
                      "flex items-center justify-center",
                      "text-muted-foreground hover:text-foreground",
                      "hover:bg-card transition-all duration-200",
                    )}
                    title="Add apps"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10">
        {/* Character Cards Carousel */}
        <div className="lg:w-1/2 flex flex-col p-6">
          <div className="relative flex-1 flex items-center">
            {/* Scroll buttons - Liquid Glass style */}
            {canScrollLeft && (
              <Button
                variant="glass"
                size="icon"
                onClick={() => scroll('left')}
                className="absolute left-0 z-20 h-10 w-10 rounded-full"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}

            {canScrollRight && (
              <Button
                variant="glass"
                size="icon"
                onClick={() => scroll('right')}
                className="absolute right-0 z-20 h-10 w-10 rounded-full"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}

            {/* Cards container */}
            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto no-visible-scrollbar px-10 py-4 scroll-smooth scroll-fade-edges"
            >
              {characters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  isSelected={selectedId === character.id}
                  onClick={() => handleSelect(character)}
                />
              ))}

              {/* Create Character card */}
              <button
                onClick={() => setCreateModalOpen(true)}
                className={cn(
                  "relative flex flex-col items-center justify-center",
                  "w-[180px] h-[260px] flex-shrink-0",
                  "rounded-2xl overflow-hidden",
                  "bg-card/40 backdrop-blur-glass",
                  "border-2 border-dashed border-border/50",
                  "shadow-glass hover:shadow-glass-lg",
                  "transition-all duration-300 ease-apple",
                  "hover:scale-[1.03] hover:-translate-y-1",
                  "hover:border-primary/30",
                  "group"
                )}
              >
                <div className="p-4 rounded-full bg-muted/30 group-hover:bg-primary/10 transition-colors duration-300">
                  <Plus className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mt-3 group-hover:text-foreground transition-colors">
                  Create Character
                </p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">
                  From your photo
                </p>
              </button>
            </div>
          </div>

          {/* Dots indicator - pill style */}
          <div className="flex justify-center gap-2 py-4">
            {characters.map((character) => (
              <button
                key={character.id}
                onClick={() => handleSelect(character)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300 ease-apple",
                  selectedId === character.id
                    ? "w-6 bg-primary"
                    : "w-2 bg-muted-foreground/25 hover:bg-muted-foreground/40"
                )}
              />
            ))}
          </div>

          {/* System Prompt editor */}
          <div className="mt-2 px-2">
            <div className="glass-card rounded-xl p-4 max-h-[160px] overflow-y-auto glass-scrollbar">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                System Prompt
              </p>
              <textarea
                className="w-full text-sm text-foreground/80 leading-relaxed bg-transparent resize-none outline-none min-h-[60px]"
                value={selectedCharacter.systemPrompt}
                onChange={(e) => {
                  const newPrompt = e.target.value
                  setCharacters(prev => prev.map(c => c.id === selectedId ? { ...c, systemPrompt: newPrompt } : c))
                }}
                onBlur={async () => {
                  try {
                    // Save to localStorage for built-in characters
                    const saved = localStorage.getItem("character-system-prompts")
                    const prompts: Record<string, string> = saved ? JSON.parse(saved) : {}
                    prompts[selectedId] = selectedCharacter.systemPrompt
                    localStorage.setItem("character-system-prompts", JSON.stringify(prompts))

                    // Also persist to backend for custom characters
                    if (selectedCharacter.isCustom) {
                      const { UpdateCustomCharacter } = await import("@/bindings/super-characters/app")
                      await UpdateCustomCharacter(
                        selectedCharacter.id,
                        selectedCharacter.name,
                        selectedCharacter.subtitle,
                        selectedCharacter.voice,
                        selectedCharacter.model,
                        selectedCharacter.description,
                        selectedCharacter.color,
                        selectedCharacter.systemPrompt,
                      )
                    }
                  } catch {}
                }}
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Character Preview */}
        <div className="lg:w-1/2 flex flex-col border-t lg:border-t-0 lg:border-l border-border/30 relative">
          {/* 3D Avatar Preview */}
          <div className="flex-1 relative min-h-[300px]">
            {/* Spotlight glow effect - enhanced */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full pointer-events-none transition-all duration-500"
              style={{
                background: `radial-gradient(ellipse, ${selectedCharacter.color}50 0%, ${selectedCharacter.color}15 50%, transparent 70%)`,
                filter: 'blur(40px)',
              }}
            />

            {/* 3D Avatar Canvas or Custom Character Preview */}
            <div className="absolute inset-0">
              {selectedCharacter.isCustom && (!selectedCharacter.avatarUrl || selectedCharacter.avatarUrl === "") ? (
                <div className="w-full h-full flex items-center justify-center">
                  {selectedCharacter.thumbnailUrl ? (
                    <img
                      src={selectedCharacter.thumbnailUrl}
                      alt={selectedCharacter.name}
                      className="w-48 h-48 rounded-3xl object-cover shadow-glass-lg border-2"
                      style={{ borderColor: selectedCharacter.color }}
                    />
                  ) : (
                    <div
                      className="w-32 h-32 rounded-3xl flex items-center justify-center text-white font-bold text-5xl shadow-glass-lg"
                      style={{ backgroundColor: selectedCharacter.color }}
                    >
                      {selectedCharacter.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              ) : (
                <AvatarPreview3D
                  key={selectedCharacter.id}
                  avatarUrl={selectedCharacter.avatarUrl}
                  onLoaded={() => console.log(`[CharacterSelector] ${selectedCharacter.name} avatar loaded`)}
                  onError={(err) => console.error(`[CharacterSelector] Failed to load ${selectedCharacter.name}:`, err)}
                />
              )}
            </div>
          </div>

          {/* Character details - Glass panel */}
          <div className="flex-shrink-0 p-6 pt-0">
            <div className="text-center space-y-1.5 max-w-sm mx-auto">
              <h2 className="text-2xl font-bold text-foreground tracking-tight drop-shadow-sm">
                {selectedCharacter.name}
              </h2>
              <p
                className="text-sm font-bold uppercase tracking-widest drop-shadow-sm"
                style={{ color: selectedCharacter.color }}
              >
                {selectedCharacter.subtitle}
              </p>
            </div>

            {/* Select button - Liquid Glass with character color */}
            <div className="flex justify-center items-center gap-3 mt-5">
              {selectedCharacter.isCustom && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteCustomCharacter(selectedCharacter.id)}
                  title="Delete character"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button
                size="lg"
                className={cn(
                  "px-8 rounded-2xl",
                  "glow-halo",
                  "shadow-glass hover:shadow-glass-lg",
                  "transition-all duration-300 ease-apple",
                  "hover:-translate-y-0.5",
                  "font-semibold"
                )}
                style={{
                  backgroundColor: selectedCharacter.color,
                  color: '#1C1C1E',
                  '--glow-color': selectedCharacter.color,
                } as React.CSSProperties}
                onClick={() => onSelect(selectedCharacter)}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Select {selectedCharacter.name}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Apps Modal */}
      <Dialog open={appsModalOpen} onOpenChange={(open) => {
        setAppsModalOpen(open)
        if (!open) refreshConnectedAccounts()
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Connected Apps</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <ComponentBrowser />
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Character Modal */}
      <CreateCharacterModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCharacterCreated={handleCharacterCreated}
      />
    </div>
  )
}
