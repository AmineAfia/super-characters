"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranscription } from "@/hooks/useTranscription";
import { Mic, MessageSquare, Trash2, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AvatarCanvasHandle } from "@/components/AvatarCanvas";

// Dynamic import to avoid SSR issues with Three.js/TalkingHead
const AvatarCanvas = dynamic(() => import("@/components/AvatarCanvas"), { ssr: false });

export default function Home() {
  const {
    isRecording,
    isReady,
    currentTranscript,
    messages,
    clearMessages,
  } = useTranscription();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<AvatarCanvasHandle>(null);
  const [hasAccessibility, setHasAccessibility] = useState<boolean | null>(null);
  const [micPermission, setMicPermission] = useState<string>("unknown");
  const [isAvatarLoading, setIsAvatarLoading] = useState(true);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Check permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const { CheckAccessibility, CheckMicrophone, RequestMicrophonePermission } = await import("../bindings/super-characters/app");
        
        // Check accessibility
        const axResult = await CheckAccessibility();
        setHasAccessibility(axResult);

        // Check microphone
        const micResult = await CheckMicrophone();
        setMicPermission(micResult);

        // Request mic permission if not asked yet
        if (micResult === "not_asked") {
          await RequestMicrophonePermission();
        }
      } catch (e) {
        console.error("Failed to check permissions:", e);
      }
    };
    checkPermissions();
    
    // Re-check every 2 seconds
    const interval = setInterval(checkPermissions, 2000);
    return () => clearInterval(interval);
  }, []);

  const openAccessibilitySettings = async () => {
    try {
      const { OpenAccessibilitySettings } = await import("../bindings/super-characters/app");
      await OpenAccessibilitySettings();
    } catch (e) {
      console.error("Failed to open settings:", e);
    }
  };

  const openMicSettings = async () => {
    try {
      const { OpenMicrophoneSettings } = await import("../bindings/super-characters/app");
      await OpenMicrophoneSettings();
    } catch (e) {
      console.error("Failed to open settings:", e);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentTranscript]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Permission Warnings */}
      <div className="flex flex-col">
        {hasAccessibility === false && (
          <div className="flex-shrink-0 p-4 bg-amber-500/10 border-b border-amber-500/20">
            <div className="flex items-center gap-3 max-w-3xl mx-auto">
              <ShieldAlert className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Accessibility permission required
                </p>
                <p className="text-xs text-amber-600/80 dark:text-amber-500/80">
                  Grant permission to enable global hotkey (⌘+Shift+Space)
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={openAccessibilitySettings}
                className="border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
              >
                Open Settings
              </Button>
            </div>
          </div>
        )}

        {micPermission === "denied" && (
          <div className="flex-shrink-0 p-4 bg-red-500/10 border-b border-red-500/20">
            <div className="flex items-center gap-3 max-w-3xl mx-auto">
              <Mic className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Microphone permission denied
                </p>
                <p className="text-xs text-red-600/80 dark:text-red-500/80">
                  Grant permission to enable voice transcription
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={openMicSettings}
                className="border-red-500/50 text-red-700 dark:text-red-400 hover:bg-red-500/10"
              >
                Open Settings
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex-shrink-0 p-6 pb-4 border-b border-border/50">
        <div className="flex items-center justify-between max-w-3xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Super Characters" className="h-10 w-10 rounded-lg" />
            <div className="space-y-1">
              <h1 className="text-xl font-medium tracking-tight">
                Super Characters
              </h1>
              <p className="text-sm text-muted-foreground">
                Hold <kbd className="px-1.5 py-0.5 text-xs rounded bg-muted font-mono">⌘+Shift+Space</kbd> to dictate
              </p>
            </div>
          </div>
          
          {/* Status indicator */}
          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMessages}
                className="text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <div className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
              ${isReady 
                ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
              }
            `}>
              <span className={`w-2 h-2 rounded-full ${isReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
              {isReady ? 'Ready' : 'Loading...'}
            </div>
          </div>
        </div>
      </div>

      {/* 3D Avatar */}
      <div className="relative h-[300px] flex-shrink-0 bg-muted/30">
        {isAvatarLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted/50">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading avatar...</span>
            </div>
          </div>
        )}
        {avatarError && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className="text-sm text-destructive">{avatarError}</span>
          </div>
        )}
        <AvatarCanvas
          ref={avatarRef}
          onLoaded={() => setIsAvatarLoading(false)}
          onError={(err) => { setIsAvatarLoading(false); setAvatarError(err); }}
        />
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && !isRecording && !currentTranscript && (
            <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
              <div className="p-4 rounded-full bg-muted/50">
                <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  No transcriptions yet
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Press and hold the hotkey to start dictating
                </p>
              </div>
            </div>
          )}

          {/* Transcription messages */}
          {messages.map((message) => (
            <div key={message.id} className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-muted text-foreground">
                <p className="text-sm leading-relaxed">{message.text}</p>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {/* Current transcript (while recording) */}
          {currentTranscript && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-muted/50 text-foreground/70 italic border border-dashed border-border">
                <p className="text-sm leading-relaxed">{currentTranscript}</p>
              </div>
            </div>
          )}

          {/* Typing indicator (while recording but no transcript yet) */}
          {isRecording && !currentTranscript && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3 bg-muted">
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4 text-red-500 animate-pulse" />
                  <div className="flex gap-1">
                    <span 
                      className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" 
                      style={{ animationDelay: '0ms' }} 
                    />
                    <span 
                      className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" 
                      style={{ animationDelay: '150ms' }} 
                    />
                    <span 
                      className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" 
                      style={{ animationDelay: '300ms' }} 
                    />
                  </div>
                  <span className="text-xs text-muted-foreground ml-1">Listening...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Footer hint */}
      <div className="flex-shrink-0 p-4 border-t border-border/50">
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Mic className="h-3 w-3" />
          <span>Hold <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">⌘+Shift+Space</kbd> to record</span>
        </div>
      </div>
    </div>
  );
}
