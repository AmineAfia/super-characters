"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import CharacterCard, { type Character } from "@/components/CharacterCard"
import { cn } from "@/lib/utils"

// Sample characters data - in a real app, this would come from settings/backend
const defaultCharacters: Character[] = [
  {
    id: "luna",
    name: "Luna",
    subtitle: "Dream Weaver",
    voice: "Rachel",
    model: "Gemini Pro",
    avatarUrl: "https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=256&textureFormat=png&preview=true",
    description: "A gentle and thoughtful companion who excels at creative conversations and storytelling. Luna's dreamy personality makes her perfect for brainstorming and imaginative discussions.",
    color: "#F5A897",
  },
  {
    id: "atlas",
    name: "Atlas",
    subtitle: "Knowledge Keeper",
    voice: "Antoni",
    model: "GPT-4",
    avatarUrl: "https://models.readyplayer.me/6721d2246d68ddd15c7488dc.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=256&textureFormat=png&preview=true",
    description: "A wise and analytical assistant focused on research and detailed explanations. Atlas helps you navigate complex topics with clarity and precision.",
    color: "#B8D4E8",
  },
  {
    id: "nova",
    name: "Nova",
    subtitle: "Energy Spark",
    voice: "Elli",
    model: "Claude 3",
    avatarUrl: "https://models.readyplayer.me/67234d396d68ddd15c79f13b.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=256&textureFormat=png&preview=true",
    description: "An enthusiastic and energetic companion who brings positivity to every conversation. Nova is great for motivation, brainstorming, and uplifting chats.",
    color: "#A8E6CF",
  },
  {
    id: "echo",
    name: "Echo",
    subtitle: "Calm Sage",
    voice: "Adam",
    model: "Gemini Pro",
    avatarUrl: "https://models.readyplayer.me/67234d866d68ddd15c79f6cc.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=256&textureFormat=png&preview=true",
    description: "A calm and composed assistant who specializes in thoughtful responses. Echo is ideal for deep conversations and mindful discussions.",
    color: "#E8E4EE",
  },
  {
    id: "pixel",
    name: "Pixel",
    subtitle: "Tech Guide",
    voice: "Josh",
    model: "GPT-4",
    avatarUrl: "https://models.readyplayer.me/67234dcc6d68ddd15c79fc24.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=256&textureFormat=png&preview=true",
    description: "A tech-savvy companion who loves helping with coding, debugging, and all things technical. Pixel makes complex tech topics accessible and fun.",
    color: "#7AB0D4",
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
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Decorative bubbles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="bubble bubble-lg top-20 left-10" style={{ animationDelay: '0s' }} />
        <div className="bubble bubble-md top-40 right-16" style={{ animationDelay: '2s' }} />
        <div className="bubble bubble-sm bottom-32 left-24" style={{ animationDelay: '4s' }} />
        <div className="bubble bubble-md bottom-20 right-32" style={{ animationDelay: '1s' }} />
      </div>

      {/* Soft radial gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(184,212,232,0.15)_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(245,168,151,0.1)_0%,transparent_50%)]" />

      {/* Header */}
      <div className="flex-shrink-0 p-6 pb-4 border-b border-border/30 glass relative z-10">
        <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img 
                src="/logo.png" 
                alt="Super Characters" 
                className="h-12 w-12 rounded-2xl shadow-soft hover:shadow-soft-lg transition-shadow duration-300" 
              />
              <div className="absolute -inset-1 rounded-2xl bg-primary/20 blur-md -z-10" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Choose Your Character
              </h1>
              <p className="text-sm text-muted-foreground">
                Select a companion to start chatting
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10">
        {/* Character Cards Carousel */}
        <div className="lg:w-1/2 flex flex-col p-6">
          <div className="relative flex-1 flex items-center">
            {/* Scroll buttons */}
            {canScrollLeft && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => scroll('left')}
                className="absolute left-0 z-20 h-10 w-10 rounded-full bg-card/80 backdrop-blur-sm shadow-soft hover:bg-card"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            
            {canScrollRight && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => scroll('right')}
                className="absolute right-0 z-20 h-10 w-10 rounded-full bg-card/80 backdrop-blur-sm shadow-soft hover:bg-card"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}

            {/* Cards container */}
            <div 
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto no-visible-scrollbar px-8 py-4 scroll-smooth scroll-fade-edges"
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

          {/* Dots indicator */}
          <div className="flex justify-center gap-2 py-4">
            {characters.map((character) => (
              <button
                key={character.id}
                onClick={() => handleSelect(character)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  selectedId === character.id
                    ? "bg-primary w-6"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>
        </div>

        {/* Character Preview */}
        <div className="lg:w-1/2 flex flex-col p-6 border-t lg:border-t-0 lg:border-l border-border/30">
          {/* Preview card */}
          <div className="flex-1 flex flex-col items-center justify-center">
            {/* Large avatar preview */}
            <div className="relative mb-6">
              <div 
                className="w-40 h-40 rounded-full overflow-hidden border-4 shadow-glow-lg"
                style={{ borderColor: selectedCharacter.color }}
              >
                <img
                  src={selectedCharacter.avatarUrl}
                  alt={selectedCharacter.name}
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
              </div>
              <div 
                className="absolute -inset-4 rounded-full blur-2xl opacity-30 -z-10"
                style={{ backgroundColor: selectedCharacter.color }}
              />
            </div>

            {/* Character details */}
            <div className="text-center space-y-3 max-w-sm">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {selectedCharacter.name}
                </h2>
                <p 
                  className="text-sm font-medium uppercase tracking-wider"
                  style={{ color: selectedCharacter.color }}
                >
                  {selectedCharacter.subtitle}
                </p>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                {selectedCharacter.description}
              </p>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <div className="p-3 rounded-xl bg-muted/50 backdrop-blur-sm border border-border/30">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Voice
                  </p>
                  <p className="font-semibold text-foreground">
                    {selectedCharacter.voice}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-muted/50 backdrop-blur-sm border border-border/30">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    LLM Model
                  </p>
                  <p className="font-semibold text-foreground">
                    {selectedCharacter.model}
                  </p>
                </div>
              </div>
            </div>

            {/* Select button */}
            <Button 
              size="lg"
              className="mt-8 px-8 rounded-2xl shadow-glow hover:shadow-glow-lg transition-all duration-300"
              style={{ 
                backgroundColor: selectedCharacter.color,
                color: '#fff'
              }}
              onClick={() => onSelect(selectedCharacter)}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Select {selectedCharacter.name}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
