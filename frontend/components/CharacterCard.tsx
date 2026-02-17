"use client"

import { cn } from "@/lib/utils"
import { Mic, Brain, Sparkles, User } from "lucide-react"

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
  systemPrompt: string
  isCustom?: boolean
  status?: string // Pipeline status for custom characters
  error?: string
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
        // Base layout
        "relative flex flex-col",
        "w-[180px] h-[260px] flex-shrink-0",

        // Liquid Glass card styling
        "rounded-2xl overflow-hidden",
        "bg-card backdrop-blur-glass",
        "border border-glass-border",

        // Refraction effect
        "liquid-glass-refraction",

        // Shadow and depth
        isSelected
          ? "shadow-glass-glow"
          : "shadow-glass hover:shadow-glass-lg",

        // Specular highlight (subtle in dark mode for readability)
        "before:absolute before:inset-0 before:pointer-events-none before:z-10",
        "before:bg-gradient-to-br before:from-white/15 before:via-white/3 before:to-transparent",
        "before:rounded-[inherit]",
        "dark:before:from-white/8 dark:before:via-transparent",

        // Transitions
        "transition-all duration-300 ease-apple",

        // Hover state
        "hover:scale-[1.03] hover:-translate-y-1",

        // Selected state
        isSelected && [
          "scale-[1.03] -translate-y-1",
          "z-10",
        ],

        // Focus
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",

        className
      )}
      style={{
        ...(isSelected ? {
          boxShadow: `0 0 20px ${character.color}40, 0 0 40px ${character.color}20, 0 8px 32px rgba(0,0,0,0.3)`,
        } as React.CSSProperties : {}),
      }}
    >
      {/* Top gradient accent - using character color */}
      <div
        className="absolute inset-x-0 top-0 h-28 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, ${character.color}60 0%, transparent 100%)`,
          opacity: isSelected ? 0.45 : 0.18,
          transition: 'opacity 0.3s ease',
        }}
      />
      
      {/* Character Avatar */}
      <div className="relative flex-1 flex items-center justify-center pt-5 px-4 z-0">
        <div
          className={cn(
            "relative w-24 h-24 rounded-full overflow-hidden",
            "border-2 transition-all duration-300",
            "shadow-glass-sm",
            isSelected
              ? "border-primary"
              : "border-glass-border"
          )}
          style={isSelected ? {
            boxShadow: `0 0 20px ${character.color}50, 0 0 40px ${character.color}25`,
          } : undefined}
        >
          {character.thumbnailUrl ? (
            <img
              src={character.thumbnailUrl}
              alt={character.name}
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-white font-bold text-2xl"
              style={{ backgroundColor: character.color }}
            >
              {character.name.charAt(0)}
            </div>
          )}
          {/* Overlay glow on selected */}
          {isSelected && (
            <div
              className="absolute inset-0 animate-pulse-soft"
              style={{ backgroundColor: `${character.color}20` }}
            />
          )}
        </div>
        
        {/* Selection sparkle indicator */}
        {isSelected && (
          <div className="absolute top-3 right-3">
            <div
              className="p-1.5 rounded-full backdrop-blur-sm"
              style={{ backgroundColor: `${character.color}30` }}
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse" style={{ color: character.color }} />
            </div>
          </div>
        )}
        {/* Custom character badge */}
        {character.isCustom && !isSelected && (
          <div className="absolute top-3 right-3">
            <div className="p-1 rounded-full bg-muted/60 backdrop-blur-sm">
              <User className="w-3 h-3 text-muted-foreground" />
            </div>
          </div>
        )}
      </div>
      
      {/* Character Info */}
      <div className="p-4 pt-2 space-y-2.5 relative z-0">
        <div className="text-center">
          <h3 className={cn(
            "font-bold text-base tracking-tight",
            isSelected ? "text-primary" : "text-card-foreground"
          )}>
            {character.name}
          </h3>
          <p
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: isSelected ? character.color : 'var(--muted-foreground)' }}
          >
            {character.subtitle}
          </p>
        </div>
        
        {/* Stats with glass pills */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Mic className="w-3 h-3" />
              <span>Voice</span>
            </span>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[11px] font-semibold",
              "bg-secondary backdrop-blur-sm",
              "text-card-foreground"
            )}>
              {character.voice}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Brain className="w-3 h-3" />
              <span>Model</span>
            </span>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[11px] font-semibold",
              "bg-secondary backdrop-blur-sm",
              "text-card-foreground"
            )}>
              {character.model}
            </span>
          </div>
        </div>
      </div>
      
      {/* Bottom accent glow */}
      <div
        className={cn(
          "absolute bottom-0 inset-x-0 h-4",
          "transition-all duration-300",
          isSelected ? "opacity-100" : "opacity-0"
        )}
        style={{
          background: `linear-gradient(to top, ${character.color}40, transparent)`,
        }}
      />
    </button>
  )
}
