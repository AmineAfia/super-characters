"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useTranscription } from "@/hooks/useTranscription";
import { useConversation } from "@/hooks/useConversation";
import { Mic, MicOff, MessageSquare, Trash2, ShieldAlert, Loader2, Settings, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import SettingsModal from "@/components/SettingsModal";
import CharacterSelector from "@/components/CharacterSelector";
import type { AvatarCanvasHandle } from "@/components/AvatarCanvas";
import type { Character } from "@/components/CharacterCard";

// Dynamic import to avoid SSR issues with Three.js/TalkingHead
const AvatarCanvas = dynamic(() => import("@/components/AvatarCanvas"), { ssr: false });

export default function Home() {
  const {
    isRecording,
    isReady,
    currentTranscript: transcriptionTranscript,
    messages,
    clearMessages,
  } = useTranscription();

  const avatarRef = useRef<AvatarCanvasHandle>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const [hasAccessibility, setHasAccessibility] = useState<boolean | null>(null);
  const [micPermission, setMicPermission] = useState<string>("unknown");
  const [isAvatarLoading, setIsAvatarLoading] = useState(true);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConversationConfigured, setIsConversationConfigured] = useState<boolean | null>(null);
  
  // Character selection state
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [showCharacterSelect, setShowCharacterSelect] = useState(true);

  // Handle audio playback via avatar
  const handleAudioReceived = useCallback(async ({ text, audioBase64 }: { text: string; audioBase64: string | null }) => {
    if (audioBase64 && avatarRef.current) {
      try {
        // Decode base64 to raw ArrayBuffer
        const binary = atob(audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        console.log("[Page] Sending", bytes.length, "bytes to TalkingHead");
        await avatarRef.current.speakAudio(bytes.buffer as ArrayBuffer, text);
      } catch (err) {
        console.error("[Page] Failed to play audio:", err);
      }
    }
  }, []);

  const {
    isActive: isConversationActive,
    isListening,
    isThinking,
    conversation,
    currentTranscript: conversationTranscript,
    currentResponse,
    startConversation,
    stopConversation,
    clearConversation,
  } = useConversation({
    onAudioReceived: handleAudioReceived,
  });

  // Check if conversation APIs are configured
  useEffect(() => {
    const checkConversationConfig = async () => {
      try {
        const { IsConversationConfigured } = await import("@/bindings/super-characters/app");
        const configured = await IsConversationConfigured();
        setIsConversationConfigured(configured);
      } catch (e) {
        setIsConversationConfigured(false);
      }
    };
    checkConversationConfig();
  }, [isSettingsOpen]); // Re-check when settings modal closes

  // Auto-activate conversation mode when hotkey is pressed
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      const { Events } = await import("@wailsio/runtime");

      unsubscribe = Events.On("overlay:show", async () => {
        // Only auto-start if conversation is configured and not already active
        if (isConversationConfigured && !isConversationActive) {
          // Resume AudioContext during this user gesture so that
          // WKWebView on macOS allows audio playback later when TTS responds.
          await avatarRef.current?.resumeAudio();
          await startConversation();
        }
      });
    };

    setup();

    return () => {
      unsubscribe?.();
    };
  }, [isConversationConfigured, isConversationActive, startConversation]);

  // Check permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const { CheckAccessibility, CheckMicrophone, RequestMicrophonePermission } = await import("@/bindings/super-characters/app");
        
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
      const { OpenAccessibilitySettings } = await import("@/bindings/super-characters/app");
      await OpenAccessibilitySettings();
    } catch (e) {
      console.error("Failed to open settings:", e);
    }
  };

  const openMicSettings = async () => {
    try {
      const { OpenMicrophoneSettings } = await import("@/bindings/super-characters/app");
      await OpenMicrophoneSettings();
    } catch (e) {
      console.error("Failed to open settings:", e);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isConversationActive) {
      conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, transcriptionTranscript, conversation, conversationTranscript, isConversationActive]);

  // Determine current transcript based on mode
  const currentTranscript = isConversationActive ? conversationTranscript : transcriptionTranscript;
  const isCurrentlyRecording = isConversationActive ? isListening : isRecording;

  // Handle character selection
  const handleCharacterSelect = (character: Character) => {
    setSelectedCharacter(character);
    setShowCharacterSelect(false);
    // Reset avatar loading state for new character
    setIsAvatarLoading(true);
    setAvatarError(null);
  };

  // Show character selection screen
  if (showCharacterSelect) {
    return <CharacterSelector onSelect={handleCharacterSelect} selectedCharacterId={selectedCharacter?.id} />;
  }

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Ambient Liquid Glass orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="bubble bubble-lg top-16 left-8" style={{ animationDelay: '0s' }} />
        <div className="bubble bubble-md top-36 right-12" style={{ animationDelay: '2s' }} />
        <div className="bubble bubble-sm bottom-36 left-20" style={{ animationDelay: '4s' }} />
        <div className="bubble bubble-md bottom-24 right-28" style={{ animationDelay: '1s' }} />
      </div>

      {/* Subtle ambient gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_75%_-10%,rgba(0,122,255,0.06),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_25%_100%,rgba(90,200,250,0.04),transparent_40%)] pointer-events-none" />

      {/* Permission Warnings - Liquid Glass style alerts */}
      <div className="flex flex-col relative z-10">
        {hasAccessibility === false && (
          <div className="flex-shrink-0 p-4 glass-subtle border-b border-system-orange/20">
            <div className="flex items-center gap-3 max-w-3xl mx-auto">
              <div className="p-2 rounded-xl bg-system-orange/15">
                <ShieldAlert className="h-4 w-4 text-system-orange" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Accessibility permission required
                </p>
                <p className="text-xs text-muted-foreground">
                  Grant permission to enable global hotkey (Cmd+Shift+Space)
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={openAccessibilitySettings}
              >
                Open Settings
              </Button>
            </div>
          </div>
        )}

        {micPermission === "denied" && (
          <div className="flex-shrink-0 p-4 glass-subtle border-b border-destructive/20">
            <div className="flex items-center gap-3 max-w-3xl mx-auto">
              <div className="p-2 rounded-xl bg-destructive/15">
                <Mic className="h-4 w-4 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Microphone permission denied
                </p>
                <p className="text-xs text-muted-foreground">
                  Grant permission to enable voice transcription
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={openMicSettings}
              >
                Open Settings
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Header - Liquid Glass panel */}
      <div className="flex-shrink-0 glass border-b border-glass-border relative z-10">
        <div className="p-5 pb-4">
          <div className="flex items-center justify-between max-w-3xl mx-auto w-full">
            <div className="flex items-center gap-4">
              {/* Back to character select button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCharacterSelect(true)}
                className="rounded-full"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              
              <div className="relative">
                {selectedCharacter ? (
                  <div 
                    className="h-11 w-11 rounded-2xl shadow-glass overflow-hidden border-2"
                    style={{ borderColor: selectedCharacter.color }}
                  >
                    <img 
                      src={selectedCharacter.thumbnailUrl}
                      alt={selectedCharacter.name}
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                    />
                  </div>
                ) : (
                  <div className="h-11 w-11 rounded-2xl shadow-glass overflow-hidden bg-card">
                    <img 
                      src="/logo.png" 
                      alt="Super Characters" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                )}
                <div className="absolute -inset-2 rounded-2xl bg-primary/8 blur-xl -z-10" />
              </div>
              <div className="space-y-0.5">
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  {selectedCharacter?.name || "Super Characters"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {selectedCharacter ? (
                    <span className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-muted/60 text-xs">{selectedCharacter.voice}</span>
                      <span className="px-2 py-0.5 rounded-md bg-muted/60 text-xs">{selectedCharacter.model}</span>
                    </span>
                  ) : (
                    <>Hold <kbd className="px-2 py-0.5 text-xs rounded-lg bg-muted/80 font-mono text-foreground/70 border border-border/50">Cmd+Shift+Space</kbd> to dictate</>
                  )}
                </p>
              </div>
            </div>
            
            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSettingsOpen(true)}
                className="rounded-full"
              >
                <Settings className="h-4 w-4" />
              </Button>
              {(isConversationActive ? conversation.length > 0 : messages.length > 0) && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={isConversationActive ? clearConversation : clearMessages}
                  className="rounded-full"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {/* Status pill - Liquid Glass style */}
              <div className={`
                status-indicator
                ${isReady 
                  ? 'status-indicator-success' 
                  : 'status-indicator-warning'
                }
              `}>
                <span className={`status-dot ${!isReady && 'status-dot-pulse'}`} />
                {isReady ? 'Ready' : 'Loading...'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3D Avatar - with subtle depth effect */}
      <div className="relative h-[300px] flex-shrink-0">
        {/* Subtle ambient gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-muted/20 to-transparent" />
        <div 
          className="absolute inset-0 opacity-10 transition-colors duration-500"
          style={{ 
            background: selectedCharacter 
              ? `radial-gradient(ellipse 60% 50% at 50% 100%, ${selectedCharacter.color}40, transparent 70%)`
              : 'radial-gradient(ellipse 60% 50% at 50% 100%, rgba(0,122,255,0.2), transparent 70%)'
          }}
        />
        
        {isAvatarLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 glass-subtle">
            <div className="flex flex-col items-center gap-4 p-6 rounded-2xl glass shadow-glass">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Loading avatar...</span>
            </div>
          </div>
        )}
        {avatarError && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="p-4 rounded-2xl status-indicator-error">
              <span className="text-sm">{avatarError}</span>
            </div>
          </div>
        )}
        <AvatarCanvas
          ref={avatarRef}
          avatarUrl={selectedCharacter?.avatarUrl}
          onLoaded={() => setIsAvatarLoading(false)}
          onError={(err) => { setIsAvatarLoading(false); setAvatarError(err); }}
        />

        {/* Status indicator overlay for conversation mode - Liquid Glass pill */}
        {isConversationActive && (
          <div className="absolute bottom-4 left-4 right-4 flex justify-center">
            <div className={`
              inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium
              backdrop-blur-glass shadow-glass border
              ${isListening
                ? 'bg-system-red/85 text-white border-system-red/30'
                : isThinking
                  ? 'bg-system-orange/85 text-white border-system-orange/30'
                  : 'bg-card/85 text-foreground border-glass-border'
              }
            `}>
              {isListening ? (
                <>
                  <Mic className="h-4 w-4 animate-pulse" />
                  <span>Listening...</span>
                </>
              ) : isThinking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <MicOff className="h-4 w-4 opacity-60" />
                  <span>Press hotkey to speak</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chat Messages - with glass scrollbar */}
      <div className="flex-1 overflow-y-auto p-6 relative z-10 glass-scrollbar">
        <div className="max-w-3xl mx-auto space-y-4">
          {isConversationActive ? (
            <>
              {/* Conversation Mode */}
              {conversation.map((turn, i) => (
                <div
                  key={i}
                  className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'} animate-liquid-slide-up`}
                >
                  <div className={`
                    max-w-[80%] rounded-2xl px-4 py-2.5 text-sm
                    ${turn.role === 'user'
                      ? 'bg-primary text-primary-foreground shadow-glass-sm'
                      : 'glass-card py-3 px-4'
                    }
                  `}>
                    {turn.text}
                  </div>
                </div>
              ))}

              {/* Current transcript (while listening) */}
              {conversationTranscript && (
                <div className="flex justify-end animate-liquid-fade-in">
                  <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-primary/60 text-primary-foreground/90 italic backdrop-blur-sm">
                    {conversationTranscript}
                  </div>
                </div>
              )}

              {/* Streaming response or thinking indicator */}
              {isThinking && (
                <div className="flex justify-start animate-liquid-slide-up">
                  {currentResponse ? (
                    <div className="max-w-[80%] rounded-2xl px-4 py-3 glass-card text-foreground text-sm">
                      {currentResponse}
                      <span className="inline-block w-1 h-4 ml-1 bg-primary rounded-full animate-pulse" />
                    </div>
                  ) : (
                    <div className="rounded-2xl px-5 py-3 glass-card">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div ref={conversationEndRef} />
            </>
          ) : (
            <>
              {/* Transcription Mode - Empty state */}
              {messages.length === 0 && !isRecording && !transcriptionTranscript && (
                <div className="flex flex-col items-center justify-center h-64 text-center gap-5">
                  <div className="p-5 rounded-full glass-subtle">
                    <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-muted-foreground">
                      No transcriptions yet
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      Press and hold the hotkey to start dictating
                    </p>
                  </div>
                </div>
              )}

              {/* Transcription messages - Liquid Glass bubbles */}
              {messages.map((message) => (
                <div key={message.id} className="flex justify-start animate-liquid-slide-up">
                  <div className="max-w-[85%] rounded-2xl px-4 py-3 glass-card">
                    <p className="text-sm leading-relaxed text-card-foreground">{message.text}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}

              {/* Current transcript (while recording) */}
              {transcriptionTranscript && (
                <div className="flex justify-start animate-liquid-fade-in">
                  <div className="max-w-[85%] rounded-2xl px-4 py-3 glass-subtle text-foreground/80 italic border border-dashed border-border/50">
                    <p className="text-sm leading-relaxed">{transcriptionTranscript}</p>
                  </div>
                </div>
              )}

              {/* Typing indicator (while recording but no transcript yet) */}
              {isRecording && !transcriptionTranscript && (
                <div className="flex justify-start animate-liquid-fade-in">
                  <div className="rounded-2xl px-4 py-3 glass-card">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-full bg-system-red/15">
                        <Mic className="h-3.5 w-3.5 text-system-red animate-pulse" />
                      </div>
                      <div className="flex gap-1.5">
                        <span 
                          className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" 
                          style={{ animationDelay: '0ms' }} 
                        />
                        <span 
                          className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" 
                          style={{ animationDelay: '150ms' }} 
                        />
                        <span 
                          className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" 
                          style={{ animationDelay: '300ms' }} 
                        />
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">Listening...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Footer hint - Liquid Glass bar */}
      <div className="flex-shrink-0 glass border-t border-glass-border relative z-10">
        <div className="p-4">
          <div className="max-w-3xl mx-auto flex items-center justify-center gap-2.5 text-xs text-muted-foreground">
            <div className="p-1.5 rounded-full bg-primary/10">
              <Mic className="h-3 w-3 text-primary" />
            </div>
            <span className="font-medium">Hold <kbd className="px-2 py-1 rounded-lg glass-subtle font-mono text-[10px] text-foreground/80 border border-border/30">Cmd+Shift+Space</kbd> to record</span>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </div>
  );
}
