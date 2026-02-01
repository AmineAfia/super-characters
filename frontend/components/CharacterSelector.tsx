"use client"

import { useState, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import { ChevronLeft, ChevronRight, Sparkles, Plus } from "lucide-react"
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

  const selectedCharacter = characters.find(c => c.id === selectedId) || characters[0]

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
                onBlur={() => {
                  try {
                    const saved = localStorage.getItem("character-system-prompts")
                    const prompts: Record<string, string> = saved ? JSON.parse(saved) : {}
                    prompts[selectedId] = selectedCharacter.systemPrompt
                    localStorage.setItem("character-system-prompts", JSON.stringify(prompts))
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

            {/* 3D Avatar Canvas */}
            <div className="absolute inset-0">
              <AvatarPreview3D
                key={selectedCharacter.id}
                avatarUrl={selectedCharacter.avatarUrl}
                onLoaded={() => console.log(`[CharacterSelector] ${selectedCharacter.name} avatar loaded`)}
                onError={(err) => console.error(`[CharacterSelector] Failed to load ${selectedCharacter.name}:`, err)}
              />
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
            <div className="flex justify-center mt-5">
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
    </div>
  )
}
