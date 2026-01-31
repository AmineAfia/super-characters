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
      {/* Decorative bubbles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="bubble bubble-lg top-20 left-10" style={{ animationDelay: '0s' }} />
        <div className="bubble bubble-md top-40 right-16" style={{ animationDelay: '2s' }} />
        <div className="bubble bubble-sm bottom-32 left-24" style={{ animationDelay: '4s' }} />
        <div className="bubble bubble-md bottom-20 right-32" style={{ animationDelay: '1s' }} />
      </div>

      {/* Permission Warnings */}
      <div className="flex flex-col relative z-10">
        {hasAccessibility === false && (
          <div className="flex-shrink-0 p-4 bg-gold/30 border-b border-gold/40 backdrop-blur-sm">
            <div className="flex items-center gap-3 max-w-3xl mx-auto">
              <ShieldAlert className="h-5 w-5 text-foreground/70 flex-shrink-0" />
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
                className="border-primary/50 text-foreground hover:bg-primary/10"
              >
                Open Settings
              </Button>
            </div>
          </div>
        )}

        {micPermission === "denied" && (
          <div className="flex-shrink-0 p-4 bg-rose/30 border-b border-rose/40 backdrop-blur-sm">
            <div className="flex items-center gap-3 max-w-3xl mx-auto">
              <Mic className="h-5 w-5 text-destructive flex-shrink-0" />
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
                className="border-destructive/50 text-foreground hover:bg-destructive/10"
              >
                Open Settings
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex-shrink-0 p-6 pb-4 border-b border-border/30 glass relative z-10">
        <div className="flex items-center justify-between max-w-3xl mx-auto w-full">
          <div className="flex items-center gap-4">
            {/* Back to character select button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCharacterSelect(true)}
              className="text-muted-foreground hover:text-foreground rounded-xl"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="relative">
              {selectedCharacter ? (
                <div 
                  className="h-12 w-12 rounded-2xl shadow-soft overflow-hidden border-2"
                  style={{ borderColor: selectedCharacter.color }}
                >
                  <img 
                    src={selectedCharacter.avatarUrl}
                    alt={selectedCharacter.name}
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                </div>
              ) : (
                <img 
                  src="/logo.png" 
                  alt="Super Characters" 
                  className="h-12 w-12 rounded-2xl shadow-soft hover:shadow-soft-lg transition-shadow duration-300" 
                />
              )}
              <div className="absolute -inset-1 rounded-2xl bg-primary/20 blur-md -z-10" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {selectedCharacter?.name || "Super Characters"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {selectedCharacter ? (
                  <span className="flex items-center gap-2">
                    <span>{selectedCharacter.voice}</span>
                    <span className="text-muted-foreground/50">|</span>
                    <span>{selectedCharacter.model}</span>
                  </span>
                ) : (
                  <>Hold <kbd className="px-2 py-1 text-xs rounded-lg bg-muted/80 font-mono text-foreground/80 border border-border/50">Cmd+Shift+Space</kbd> to dictate</>
                )}
              </p>
            </div>
          </div>
          
          {/* Status indicator */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSettingsOpen(true)}
              className="text-muted-foreground hover:text-foreground rounded-xl"
            >
              <Settings className="h-4 w-4" />
            </Button>
            {(isConversationActive ? conversation.length > 0 : messages.length > 0) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={isConversationActive ? clearConversation : clearMessages}
                className="text-muted-foreground hover:text-foreground rounded-xl"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <div className={`
              flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold shadow-soft
              ${isReady 
                ? 'bg-mint/30 text-foreground border border-mint/50' 
                : 'bg-gold/30 text-foreground border border-gold/50'
              }
            `}>
              <span className={`w-2 h-2 rounded-full ${isReady ? 'bg-mint' : 'bg-gold animate-pulse'}`} />
              {isReady ? 'Ready' : 'Loading...'}
            </div>
          </div>
        </div>
      </div>

      {/* 3D Avatar */}
      <div className="relative h-[300px] flex-shrink-0 bg-gradient-to-b from-lavender-light/50 to-cream/50 dark:from-muted/30 dark:to-background/50">
        {/* Radial gradient overlay for dreamy effect */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,168,151,0.1)_0%,transparent_70%)]" />
        
        {isAvatarLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 glass">
            <div className="flex flex-col items-center gap-4 p-6 rounded-3xl bg-card/80 shadow-soft">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Loading avatar...</span>
            </div>
          </div>
        )}
        {avatarError && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30">
              <span className="text-sm text-destructive">{avatarError}</span>
            </div>
          </div>
        )}
        <AvatarCanvas
          ref={avatarRef}
          avatarUrl={selectedCharacter?.avatarUrl}
          onLoaded={() => setIsAvatarLoading(false)}
          onError={(err) => { setIsAvatarLoading(false); setAvatarError(err); }}
        />

        {/* Status indicator overlay for conversation mode */}
        {isConversationActive && (
          <div className="absolute bottom-4 left-4 right-4 flex justify-center">
            <div className={`
              inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium
              ${isListening
                ? 'bg-red-500/90 text-white'
                : isThinking
                  ? 'bg-yellow-500/90 text-white'
                  : 'bg-gray-900/70 text-white'
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
                  <MicOff className="h-4 w-4" />
                  <span>Press hotkey to speak</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6 relative z-10">
        <div className="max-w-3xl mx-auto space-y-4">
          {isConversationActive ? (
            <>
              {/* Conversation Mode */}
              {conversation.map((turn, i) => (
                <div
                  key={i}
                  className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`
                    max-w-[80%] rounded-2xl px-4 py-2.5 text-sm
                    ${turn.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-muted text-foreground'
                    }
                  `}>
                    {turn.text}
                  </div>
                </div>
              ))}

              {/* Current transcript (while listening) */}
              {conversationTranscript && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-blue-600/50 text-white/80 italic">
                    {conversationTranscript}
                  </div>
                </div>
              )}

              {/* Streaming response or thinking indicator */}
              {isThinking && (
                <div className="flex justify-start">
                  {currentResponse ? (
                    <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-muted text-foreground">
                      {currentResponse}
                      <span className="inline-block w-1.5 h-4 ml-1 bg-foreground/60 animate-pulse" />
                    </div>
                  ) : (
                    <div className="rounded-2xl px-4 py-2.5 bg-muted">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div ref={conversationEndRef} />
            </>
          ) : (
            <>
              {/* Transcription Mode */}
              {messages.length === 0 && !isRecording && !transcriptionTranscript && (
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
              {transcriptionTranscript && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-muted/50 text-foreground/70 italic border border-dashed border-border">
                    <p className="text-sm leading-relaxed">{transcriptionTranscript}</p>
                  </div>
                </div>
              )}

              {/* Typing indicator (while recording but no transcript yet) */}
              {isRecording && !transcriptionTranscript && (
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
            </>
          )}
        </div>
      </div>

      {/* Footer hint */}
      <div className="flex-shrink-0 p-4 border-t border-border/30 glass relative z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Mic className="h-3.5 w-3.5 text-primary/60" />
          <span className="font-medium">Hold <kbd className="px-2 py-1 rounded-lg bg-muted/80 font-mono text-[10px] text-foreground/80 border border-border/50">Cmd+Shift+Space</kbd> to record</span>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </div>
  );
}
