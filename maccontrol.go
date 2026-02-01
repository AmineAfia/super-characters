package main

import (
	"context"
	"fmt"
	"log/slog"
	"os/exec"
	"strings"
	"time"
)

// #region Mac Control API

// RunAppleScript executes an arbitrary AppleScript string and returns the result.
// The script runs with a 10-second timeout.
func (a *App) RunAppleScript(script string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "osascript", "-e", script)
	output, err := cmd.CombinedOutput()
	result := strings.TrimSpace(string(output))

	if err != nil {
		slog.Error("[MacControl] AppleScript failed", "error", err, "output", result)
		return result, fmt.Errorf("AppleScript error: %s", result)
	}

	slog.Info("[MacControl] AppleScript executed", "result", result)
	return result, nil
}

// PlayPauseMusic toggles play/pause on Spotify or Apple Music (whichever is running).
func (a *App) PlayPauseMusic() (string, error) {
	script := `
		if application "Spotify" is running then
			tell application "Spotify" to playpause
			return "Toggled Spotify playback"
		else if application "Music" is running then
			tell application "Music" to playpause
			return "Toggled Apple Music playback"
		else
			tell application "Music"
				activate
				delay 1
				play
			end tell
			return "Started Apple Music"
		end if
	`
	return a.RunAppleScript(script)
}

// NextTrack skips to the next track on Spotify or Apple Music.
func (a *App) NextTrack() (string, error) {
	script := `
		if application "Spotify" is running then
			tell application "Spotify" to next track
			return "Skipped to next track on Spotify"
		else if application "Music" is running then
			tell application "Music" to next track
			return "Skipped to next track on Apple Music"
		else
			return "No music player is running"
		end if
	`
	return a.RunAppleScript(script)
}

// PreviousTrack goes back to the previous track on Spotify or Apple Music.
func (a *App) PreviousTrack() (string, error) {
	script := `
		if application "Spotify" is running then
			tell application "Spotify" to previous track
			return "Went to previous track on Spotify"
		else if application "Music" is running then
			tell application "Music" to previous track
			return "Went to previous track on Apple Music"
		else
			return "No music player is running"
		end if
	`
	return a.RunAppleScript(script)
}

// SetVolume sets the system output volume (0–100).
func (a *App) SetVolume(level int) (string, error) {
	if level < 0 {
		level = 0
	}
	if level > 100 {
		level = 100
	}
	script := fmt.Sprintf("set volume output volume %d", level)
	_, err := a.RunAppleScript(script)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("Volume set to %d", level), nil
}

// OpenApplication opens (or activates) a macOS application by name.
func (a *App) OpenApplication(name string) (string, error) {
	script := fmt.Sprintf(`tell application %q to activate`, name)
	_, err := a.RunAppleScript(script)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("Opened %s", name), nil
}

// GetNowPlaying returns information about the currently playing track.
func (a *App) GetNowPlaying() (string, error) {
	script := `
		if application "Spotify" is running then
			tell application "Spotify"
				if player state is playing then
					set trackName to name of current track
					set artistName to artist of current track
					set albumName to album of current track
					return "Playing on Spotify: " & trackName & " by " & artistName & " from " & albumName
				else
					return "Spotify is paused"
				end if
			end tell
		else if application "Music" is running then
			tell application "Music"
				if player state is playing then
					set trackName to name of current track
					set artistName to artist of current track
					set albumName to album of current track
					return "Playing on Apple Music: " & trackName & " by " & artistName & " from " & albumName
				else
					return "Apple Music is paused"
				end if
			end tell
		else
			return "No music player is running"
		end if
	`
	return a.RunAppleScript(script)
}

// #endregion Mac Control API
