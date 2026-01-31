"use client"

import { cn } from "@/lib/utils"
import { Mic, Brain, Sparkles } from "lucide-react"

export interface Character {
  id: string
  name: string
  subtitle: string
  voice: string
  model: string
  avatarUrl: string
  thumbnailUrl: string
  description: string
  color: string
}

interface CharacterCardProps {
  character: Character
  isSelected: boolean
  onClick: () => void
  className?: string
}

export default function CharacterCard({ 
  character, 
  isSelected, 
  onClick,
  className 
}: CharacterCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col rounded-2xl border-2 transition-all duration-300 ease-out",
        "w-[180px] h-[260px] flex-shrink-0 overflow-hidden",
        "backdrop-blur-md bg-card/80",
        "hover:scale-105 hover:shadow-soft-lg",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isSelected 
          ? "border-primary shadow-glow scale-105 z-10" 
          : "border-border/50 hover:border-primary/50",
        className
      )}
    >
      {/* Gradient overlay at top */}
      <div 
        className="absolute inset-x-0 top-0 h-24 opacity-30"
        style={{ 
          background: `linear-gradient(180deg, ${character.color}40 0%, transparent 100%)` 
        }}
      />
      
      {/* Character Avatar */}
      <div className="relative flex-1 flex items-center justify-center pt-4 px-4">
        <div className={cn(
          "relative w-24 h-24 rounded-full overflow-hidden",
          "border-2 transition-all duration-300",
          isSelected ? "border-primary shadow-glow" : "border-border/30"
        )}>
          <img
            src={character.thumbnailUrl}
            alt={character.name}
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
          />
          {isSelected && (
            <div className="absolute inset-0 bg-primary/10 animate-pulse-soft" />
          )}
        </div>
        
        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          </div>
        )}
      </div>
      
      {/* Character Info */}
      <div className="p-4 pt-2 space-y-2">
        <div className="text-center">
          <h3 className={cn(
            "font-semibold text-base tracking-tight text-foreground",
            isSelected && "text-gradient"
          )}>
            {character.name}
          </h3>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {character.subtitle}
          </p>
        </div>
        
        {/* Stats */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <Mic className="w-3 h-3" />
              Voice
            </span>
            <span className="font-medium text-foreground truncate max-w-[80px]">
              {character.voice}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <Brain className="w-3 h-3" />
              Model
            </span>
            <span className="font-medium text-foreground truncate max-w-[80px]">
              {character.model}
            </span>
          </div>
        </div>
      </div>
      
      {/* Bottom accent line */}
      <div 
        className={cn(
          "absolute bottom-0 inset-x-0 h-1 transition-opacity duration-300",
          isSelected ? "opacity-100" : "opacity-0"
        )}
        style={{ backgroundColor: character.color }}
      />
    </button>
  )
}
