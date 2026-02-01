/**
 * Tool definitions for the conversation agent
 *
 * This file is extensible - add new tools here as the agent's capabilities grow.
 * Tools allow the agent to perform actions and retrieve information.
 */

import { tool } from "ai";
import { z } from "zod";
import * as App from "../../bindings/super-characters/app";

/**
 * Get current date and time
 * A simple tool that demonstrates the pattern for adding more complex tools
 */
export const getCurrentTime = tool({
  description: "Get the current date and time",
  inputSchema: z.object({}),
  execute: async () => {
    const now = new Date();
    return {
      date: now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      time: now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      timestamp: now.toISOString(),
    };
  },
});

/**
 * Play/pause music on Spotify or Apple Music
 */
export const playPauseMusic = tool({
  description:
    "Toggle play/pause on the currently running music player (Spotify or Apple Music). If neither is running, starts Apple Music.",
  inputSchema: z.object({}),
  execute: async () => {
    const result = await App.PlayPauseMusic();
    return { result };
  },
});

/**
 * Skip to next track
 */
export const nextTrack = tool({
  description: "Skip to the next track on Spotify or Apple Music",
  inputSchema: z.object({}),
  execute: async () => {
    const result = await App.NextTrack();
    return { result };
  },
});

/**
 * Go to previous track
 */
export const previousTrack = tool({
  description: "Go back to the previous track on Spotify or Apple Music",
  inputSchema: z.object({}),
  execute: async () => {
    const result = await App.PreviousTrack();
    return { result };
  },
});

/**
 * Set system volume
 */
export const setVolume = tool({
  description: "Set the Mac system output volume. Level is 0 (mute) to 100 (max).",
  inputSchema: z.object({
    level: z.number().min(0).max(100).describe("Volume level from 0 to 100"),
  }),
  execute: async ({ level }) => {
    const result = await App.SetVolume(level);
    return { result };
  },
});

/**
 * Open a macOS application
 */
export const openApplication = tool({
  description: "Open (or activate) a macOS application by name, e.g. Safari, Finder, Notes",
  inputSchema: z.object({
    name: z.string().describe("The name of the application to open"),
  }),
  execute: async ({ name }) => {
    const result = await App.OpenApplication(name);
    return { result };
  },
});

/**
 * Get currently playing track info
 */
export const getNowPlaying = tool({
  description: "Get information about the currently playing track on Spotify or Apple Music",
  inputSchema: z.object({}),
  execute: async () => {
    const result = await App.GetNowPlaying();
    return { result };
  },
});

/**
 * Run arbitrary AppleScript
 */
export const runAppleScript = tool({
  description:
    "Run an arbitrary AppleScript on the Mac. Use this as a fallback for Mac control actions not covered by the specific tools. The script has a 10-second timeout.",
  inputSchema: z.object({
    script: z.string().describe("The AppleScript code to execute"),
  }),
  execute: async ({ script }) => {
    const result = await App.RunAppleScript(script);
    return { result };
  },
});

/**
 * All available tools for the conversation agent
 * Add new tools here to make them available to the agent
 */
export const agentTools = {
  getCurrentTime,
  playPauseMusic,
  nextTrack,
  previousTrack,
  setVolume,
  openApplication,
  getNowPlaying,
  runAppleScript,
} as const;

export type AgentTools = typeof agentTools;
