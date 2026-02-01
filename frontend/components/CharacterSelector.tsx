"use client"

import { useState, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import CharacterCard, { type Character } from "@/components/CharacterCard"
import { cn } from "@/lib/utils"

// Dynamically import AvatarPreview3D with SSR disabled (Three.js is browser-only)
const AvatarPreview3D = dynamic(() => import("@/components/AvatarPreview3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted/20 animate-pulse rounded-2xl">
      <div className="w-16 h-16 rounded-full bg-muted/30" />
    </div>
  ),
})

// Helper to get thumbnail URL from GLB URL
function getAvatarThumbnail(glbUrl: string): string {
  // Ready Player Me provides PNG renders by replacing .glb with .png
  return glbUrl.replace(/\.glb.*$/, '.png')
}

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
  const [characters] = useState<Character[]>(defaultCharacters)
  const [selectedId, setSelectedId] = useState(selectedCharacterId || characters[0]?.id)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

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
    onSelect(character)
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
              <h2 className="text-2xl font-bold text-foreground tracking-tight">
                {selectedCharacter.name}
              </h2>
              <p 
                className="text-sm font-semibold uppercase tracking-widest"
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
                  "hover:-translate-y-0.5"
                )}
                style={{
                  backgroundColor: selectedCharacter.color,
                  color: '#FFFFFF',
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
    </div>
  )
}
