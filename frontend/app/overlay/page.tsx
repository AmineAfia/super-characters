"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { AvatarCanvasHandle } from "@/components/AvatarCanvas";
import { Mic, Loader2, Volume2 } from "lucide-react";

// Dynamic import to avoid SSR issues with Three.js/TalkingHead
const AvatarCanvas = dynamic(() => import("@/components/AvatarCanvas"), { ssr: false });

// Extended states for continuous conversation mode
type OverlayState = "hidden" | "listening" | "speech-detected" | "processing" | "thinking" | "speaking";

export default function OverlayPage() {
  const [state, setState] = useState<OverlayState>("listening");
  const [isVisible, setIsVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isAvatarLoading, setIsAvatarLoading] = useState(true);
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<AvatarCanvasHandle>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ResizeObserver effect to resize the overlay window
  useEffect(() => {
    if (!mounted || !containerRef.current) return;

    let resizeObserver: ResizeObserver | null = null;
    let debounceTimeout: NodeJS.Timeout | null = null;
    let lastWidth = 0;
    let lastHeight = 0;

    const loadAndObserve = async () => {
      const { ResizeOverlay } = await import("@/bindings/super-characters/app");

      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width = Math.ceil(entry.contentRect.width);
          const height = Math.ceil(entry.contentRect.height);

          // Skip if dimensions haven't changed significantly (within 2px)
          if (Math.abs(width - lastWidth) < 2 && Math.abs(height - lastHeight) < 2) {
            continue;
          }

          // Clear any pending debounce
          if (debounceTimeout) {
            clearTimeout(debounceTimeout);
          }

          // Debounce: wait for animation to settle before repositioning
          debounceTimeout = setTimeout(() => {
            lastWidth = width;
            lastHeight = height;
            ResizeOverlay(width + 4, height + 4);
          }, 150);
        }
      });

      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }
    };

    loadAndObserve();

    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [mounted]);

  // Event listeners
  useEffect(() => {
    if (!mounted) return;

    let cleanupFns: (() => void)[] = [];

    const setupListeners = async () => {
      const { Events } = await import("@wailsio/runtime");

      // Listen for overlay state
      const unsubscribeShow = Events.On("overlay:show", (event: any) => {
        const newState = event.data?.state || "listening";
        setState(newState === "recording" ? "listening" : newState as OverlayState);
        setIsVisible(true);
      });

      const unsubscribeHide = Events.On("overlay:hide", () => {
        setState("hidden");
        setIsVisible(false);
        setIsContinuousMode(false);
      });

      // Continuous conversation mode events
      const unsubscribeListeningStarted = Events.On("conversation:listening-started", () => {
        setIsContinuousMode(true);
        setState("listening");
      });

      const unsubscribeListeningStopped = Events.On("conversation:listening-stopped", () => {
        setIsContinuousMode(false);
      });

      const unsubscribeSpeechDetected = Events.On("conversation:speech-detected", () => {
        setState("speech-detected");
      });

      const unsubscribeProcessing = Events.On("conversation:processing", () => {
        setState("processing");
      });

      const unsubscribeListeningResumed = Events.On("conversation:listening-resumed", () => {
        setState("listening");
      });

      // Listen for conversation events
      const unsubscribeThinking = Events.On("conversation:thinking", () => {
        setState("thinking");
      });

      const unsubscribeResponse = Events.On("conversation:response", async () => {
        // Update visual state only — audio playback is handled by the main window
        // to avoid both windows playing audio simultaneously.
        setState("speaking");
        // In continuous mode, backend will emit listening-resumed
        // In non-continuous mode, stay in speaking briefly then reset
        if (!isContinuousMode) {
          setTimeout(() => setState("listening"), 100);
        }
      });

      const unsubscribeError = Events.On("conversation:error", () => {
        // Go back to listening state on error
        setState("listening");
      });

      cleanupFns = [
        unsubscribeShow,
        unsubscribeHide,
        unsubscribeListeningStarted,
        unsubscribeListeningStopped,
        unsubscribeSpeechDetected,
        unsubscribeProcessing,
        unsubscribeListeningResumed,
        unsubscribeThinking,
        unsubscribeResponse,
        unsubscribeError,
      ];
    };

    setupListeners();

    return () => {
      cleanupFns.forEach((fn) => fn());
    };
  }, [mounted, isContinuousMode]);

  if (!mounted) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 flex items-end justify-start"
      style={{ background: "transparent", border: "none", outline: "none" }}
    >
      <div
        ref={containerRef}
        className="relative w-[280px] h-[320px]"
        style={{ border: "none", outline: "none" }}
      >
        {/* Avatar Canvas */}
        <div className="w-full h-full">
          {isAvatarLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Loader2 className="h-8 w-8 animate-spin text-white/50" />
            </div>
          )}
          <AvatarCanvas
            ref={avatarRef}
            onLoaded={() => setIsAvatarLoading(false)}
            onError={(err) => {
              setIsAvatarLoading(false);
              console.error("[OverlayPage] Avatar error:", err);
            }}
          />
        </div>

        {/* Status indicator */}
        {isVisible && !isAvatarLoading && (
          <div className="absolute bottom-2 left-2 right-2 flex justify-center">
            <div
              className={`
                inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200
                ${state === "listening"
                  ? "bg-blue-500/90 text-white"
                  : state === "speech-detected"
                    ? "bg-red-500/90 text-white"
                    : state === "processing"
                      ? "bg-orange-500/90 text-white"
                      : state === "thinking"
                        ? "bg-yellow-500/90 text-white"
                        : state === "speaking"
                          ? "bg-green-500/90 text-white"
                          : "bg-gray-900/70 text-white"
                }
              `}
            >
              {state === "listening" ? (
                <>
                  <Mic className="h-3 w-3" />
                  <span>Listening...</span>
                </>
              ) : state === "speech-detected" ? (
                <>
                  <Mic className="h-3 w-3 animate-pulse" />
                  <span>Speaking...</span>
                </>
              ) : state === "processing" ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : state === "thinking" ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Thinking...</span>
                </>
              ) : state === "speaking" ? (
                <>
                  <Volume2 className="h-3 w-3 animate-pulse" />
                  <span>Responding...</span>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
