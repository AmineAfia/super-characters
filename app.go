package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"super-characters/audio"
	"super-characters/elevenlabs"
	"super-characters/gemini"
	"super-characters/hotkey"
	"super-characters/permissions"
	"super-characters/settings"
	"super-characters/transcription"
	"super-characters/vad"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// ConversationState represents the current state of the continuous conversation
type ConversationState string

const (
	ConversationStateIdle       ConversationState = "idle"
	ConversationStateListening  ConversationState = "listening"
	ConversationStateProcessing ConversationState = "processing"
	ConversationStateSpeaking   ConversationState = "speaking"
)

// App struct holds application state and dependencies
type App struct {
	app           *application.App
	window        *application.WebviewWindow
	overlayWindow *application.WebviewWindow

	// Transcription services
	transcriptionService *transcription.TranscriptionService
	audioService         *audio.AudioService
	hotkeyService        *hotkey.HotkeyService
	permissionsService   *permissions.PermissionsService

	// Conversation mode services
	geminiService     *gemini.GeminiService
	elevenlabsService *elevenlabs.ElevenLabsService
	settingsService   *settings.SettingsService

	// Recording state
	isTranscribing bool
	recordingMutex sync.Mutex

	// Overlay state
	overlayVisible     bool
	pressAndTalkActive bool

	// Conversation mode state
	isConversationMode  bool
	conversationHistory []gemini.ChatMessage

	// Continuous conversation mode (VAD-based)
	vadService             *vad.VADService
	continuousMode         bool
	continuousStateMutex   sync.Mutex
	continuousState        ConversationState
	pendingSpeechProcessed bool // Prevents duplicate processing

	// Context for transcription
	ctx    context.Context
	cancel context.CancelFunc
}

// NewApp creates a new App instance
func NewApp() *App {
	permSvc, _ := permissions.NewPermissionsService()
	settingsSvc, _ := settings.NewSettingsService()

	// Get silence duration from settings or use default
	silenceDuration := 300 * time.Millisecond
	if settingsSvc != nil {
		silenceDuration = time.Duration(settingsSvc.GetSilenceDurationMs()) * time.Millisecond
	}

	vadCfg := vad.DefaultConfig()
	vadCfg.SilenceDuration = silenceDuration

	return &App{
		transcriptionService: transcription.NewTranscriptionService(),
		audioService:         audio.NewAudioService(),
		hotkeyService:        hotkey.NewHotkeyService(),
		permissionsService:   permSvc,
		geminiService:        gemini.NewGeminiService(),
		elevenlabsService:    elevenlabs.NewElevenLabsService(),
		settingsService:      settingsSvc,
		vadService:           vad.NewVADService(vadCfg),
		continuousState:      ConversationStateIdle,
	}
}

// SetApp injects the Wails application reference
func (a *App) SetApp(app *application.App) {
	a.app = app
	a.transcriptionService.SetApp(app)
}

// SetWindow registers the main window
func (a *App) SetWindow(window *application.WebviewWindow) {
	a.window = window
}

// SetOverlayWindow registers the overlay window
func (a *App) SetOverlayWindow(window *application.WebviewWindow) {
	a.overlayWindow = window
}

// #region Overlay Management

// showOverlay shows the 3D character overlay window
func (a *App) showOverlay() {
	if a.overlayWindow == nil {
		slog.Warn("overlay window not available")
		return
	}

	a.overlayVisible = true

	// Emit overlay show event
	if a.app != nil {
		a.app.Event.Emit("overlay:show", map[string]interface{}{
			"state":       "recording",
			"overlayMode": true,
		})
	}

	// Position overlay at bottom-left of screen
	a.positionOverlayBottomLeft(300, 350)
	a.overlayWindow.Show()
	// Explicitly set AlwaysOnTop after showing - required because Wails only sets
	// window level on WindowDidBecomeKey event for hidden windows, but our overlay
	// doesn't become the key window
	a.overlayWindow.SetAlwaysOnTop(true)

	slog.Info("overlay shown")
}

// hideOverlay hides the overlay window
func (a *App) hideOverlay() {
	if a.overlayWindow == nil {
		return
	}

	a.overlayVisible = false

	// Emit overlay hide event
	if a.app != nil {
		a.app.Event.Emit("overlay:hide", nil)
	}

	a.overlayWindow.Hide()
	slog.Info("overlay hidden")
}

// positionOverlayBottomLeft positions the overlay at the bottom-left of the screen
func (a *App) positionOverlayBottomLeft(width, height int) {
	if a.overlayWindow == nil {
		return
	}

	// Get target screen info
	screenX, screenY, _, screenHeight := a.getScreenWorkArea()

	// Calculate the desired position in logical coordinates (top-left origin)
	// Position at bottom-left with 40px padding from the left and bottom
	targetPosX := screenX + 40
	targetPosY := screenY + screenHeight - height - 40

	// Get the overlay's current screen info for scale factor
	overlayScreen, err := a.overlayWindow.GetScreen()
	if err != nil || overlayScreen == nil {
		// Fallback: try to position directly (may not work correctly on Retina)
		a.overlayWindow.SetPosition(targetPosX, targetPosY)
		return
	}

	scaleFactor := overlayScreen.ScaleFactor
	if scaleFactor < 1 {
		scaleFactor = 1 // Safety fallback
	}

	// WORKAROUND for Wails coordinate scaling bug:
	// Wails' SetPosition on macOS divides coordinates by scale factor.
	// To get the correct position, we must multiply by scale factor.
	adjustedX := int(float32(targetPosX) * scaleFactor)
	adjustedY := int(float32(targetPosY) * scaleFactor)

	a.overlayWindow.SetPosition(adjustedX, adjustedY)
}

// ResizeOverlay resizes the overlay window and re-positions it at the bottom-left
func (a *App) ResizeOverlay(width int, height int) {
	if a.overlayWindow == nil {
		return
	}

	a.overlayWindow.SetSize(width, height)
	// Re-position using the same bottom-left positioning
	a.positionOverlayBottomLeft(width, height)
}

// getScreenWorkArea returns the work area (x, y, width, height) of the current screen
func (a *App) getScreenWorkArea() (x, y, width, height int) {
	// Get all screens first
	screens := a.app.Screen.GetAll()

	// If we have screens and a main window, find the screen containing the window
	if len(screens) > 0 && a.window != nil {
		wx, wy := a.window.Position()
		ww, wh := a.window.Size()
		// Use the center point of the window to determine which screen it's on
		windowCenterX := wx + ww/2
		windowCenterY := wy + wh/2

		// Find which screen contains the window's center
		for _, screen := range screens {
			screenRight := screen.X + screen.Size.Width
			screenBottom := screen.Y + screen.Size.Height

			if windowCenterX >= screen.X && windowCenterX < screenRight &&
				windowCenterY >= screen.Y && windowCenterY < screenBottom {
				return screen.WorkArea.X, screen.WorkArea.Y, screen.WorkArea.Width, screen.WorkArea.Height
			}
		}

		// If no screen contains the window center, try window.GetScreen() as fallback
		screen, err := a.window.GetScreen()
		if err == nil && screen != nil {
			return screen.WorkArea.X, screen.WorkArea.Y, screen.WorkArea.Width, screen.WorkArea.Height
		}
	}

	// If no screens available, try window.GetScreen() directly
	if a.window != nil {
		screen, err := a.window.GetScreen()
		if err == nil && screen != nil {
			return screen.WorkArea.X, screen.WorkArea.Y, screen.WorkArea.Width, screen.WorkArea.Height
		}
	}

	// Use primary screen for overlay positioning
	for _, screen := range screens {
		if screen.IsPrimary {
			return screen.WorkArea.X, screen.WorkArea.Y, screen.WorkArea.Width, screen.WorkArea.Height
		}
	}

	// Fallback: Return first screen if no primary found
	if len(screens) > 0 {
		return screens[0].WorkArea.X, screens[0].WorkArea.Y, screens[0].WorkArea.Width, screens[0].WorkArea.Height
	}

	// Ultimate fallback: reasonable defaults
	return 0, 0, 1920, 1080
}

// IsOverlayVisible returns whether the overlay is currently visible
func (a *App) IsOverlayVisible() bool {
	return a.overlayVisible
}

// #endregion Overlay Management

// ServiceStartup is called when the application starts (Wails v3 service interface)
func (a *App) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	a.ctx = ctx
	slog.Info("App service starting up")

	// Configure conversation services from settings
	if a.settingsService != nil {
		currentSettings := a.settingsService.GetSettings()
		if a.geminiService != nil && currentSettings.GeminiAPIKey != "" {
			a.geminiService.SetAPIKey(currentSettings.GeminiAPIKey)
			slog.Info("Gemini service configured from settings")
		}
		if a.elevenlabsService != nil {
			if currentSettings.ElevenLabsAPIKey != "" {
				a.elevenlabsService.SetAPIKey(currentSettings.ElevenLabsAPIKey)
				slog.Info("ElevenLabs service configured from settings")
			}
			if currentSettings.ElevenLabsVoiceID != "" {
				a.elevenlabsService.SetVoiceID(currentSettings.ElevenLabsVoiceID)
			}
		}
	}

	// Initialize transcription service
	go func() {
		if err := a.transcriptionService.Initialize(""); err != nil {
			slog.Warn("transcription service not ready", "error", err)
			// Emit event to frontend about model not being ready
			if a.app != nil {
				a.app.Event.Emit("transcription:not-ready", map[string]interface{}{
					"error": err.Error(),
				})
			}
		} else {
			slog.Info("transcription service initialized")
			if a.app != nil {
				a.app.Event.Emit("transcription:ready", nil)
			}
		}
	}()

	// Set up audio level callback for UI visualization
	a.audioService.SetAudioLevelCallback(func(level float32) {
		if a.app != nil {
			a.app.Event.Emit("audio:level", map[string]interface{}{
				"level": level,
			})
		}
	})

	// Register hotkeys after a short delay to ensure event loop is running
	go func() {
		time.Sleep(500 * time.Millisecond)
		a.RegisterHotkeys()
	}()

	return nil
}

// ServiceShutdown is called when the application is shutting down
func (a *App) ServiceShutdown() error {
	slog.Info("App service shutting down")

	// Stop continuous listening if active
	a.stopContinuousListening()

	// Stop hotkey service
	a.hotkeyService.Stop()

	// Stop VAD service
	if a.vadService != nil {
		a.vadService.Stop()
	}

	// Stop audio service
	a.audioService.Stop()

	// Close transcription service
	a.transcriptionService.Close()

	return nil
}

// RegisterHotkeys sets up the global hotkeys after the app window is ready
func (a *App) RegisterHotkeys() {
	slog.Info("Registering global hotkeys")

	// Default hold-to-talk hotkey: Ctrl+Option+Cmd (modifier-only)
	holdToTalkHotkey := "Ctrl+Option+Cmd"

	// Get press-and-talk hotkey from settings (defaults to Ctrl+Shift+Space)
	pressAndTalkHotkey := ""
	if a.settingsService != nil {
		pressAndTalkHotkey = a.settingsService.GetPressAndTalkHotkey()
	}

	// Set up the press-and-talk toggle callback
	// This is called when the hands-free (press-and-talk) hotkey is toggled
	a.hotkeyService.SetHandsFreeCallback(a.onPressAndTalkToggle)

	err := a.hotkeyService.StartWithRelease(
		a.ctx,
		holdToTalkHotkey,
		pressAndTalkHotkey,
		a.onHotkeyPressed,
		a.onHotkeyReleased,
	)
	if err != nil {
		slog.Error("failed to register hotkey", "error", err)
	} else {
		slog.Info("global hotkeys registered", "holdToTalk", holdToTalkHotkey, "pressAndTalk", pressAndTalkHotkey)
	}
}

// onPressAndTalkToggle handles the press-and-talk hotkey toggle
// When enabled, shows overlay and starts continuous listening with VAD
// When disabled, stops listening and hides overlay
func (a *App) onPressAndTalkToggle(enabled bool) {
	slog.Info("press-and-talk toggled", "enabled", enabled)

	if enabled {
		// Show overlay and start continuous listening
		a.pressAndTalkActive = true
		a.showOverlay()
		go a.startContinuousListening()
	} else {
		// Stop continuous listening and hide overlay
		a.pressAndTalkActive = false
		go a.stopContinuousListening()
		a.hideOverlay()
	}
}

// onHotkeyPressed handles the hotkey press event (start recording)
func (a *App) onHotkeyPressed() {
	slog.Info("hotkey pressed - starting recording")
	go a.StartTranscription("en")
}

// onHotkeyReleased handles the hotkey release event (stop recording)
func (a *App) onHotkeyReleased() {
	slog.Info("hotkey released - stopping recording")
	go a.StopTranscription()
}

// StartTranscription begins recording and transcription
func (a *App) StartTranscription(language string) string {
	a.recordingMutex.Lock()
	defer a.recordingMutex.Unlock()

	if a.isTranscribing {
		return "Already transcribing"
	}

	if !a.transcriptionService.IsInitialized() {
		return "Transcription service not ready"
	}

	// Set language
	if language != "" {
		a.transcriptionService.SetLanguage(language)
	}

	// Start audio capture
	if err := a.audioService.Start(); err != nil {
		slog.Error("failed to start audio capture", "error", err)
		return "Failed to start audio capture: " + err.Error()
	}

	a.isTranscribing = true

	// Emit overlay:show event for frontend UI
	if a.app != nil {
		a.app.Event.Emit("overlay:show", map[string]interface{}{
			"state": "recording",
		})
	}

	slog.Info("transcription started")
	return "Recording started"
}

// StopTranscription stops recording and processes the audio
func (a *App) StopTranscription() string {
	a.recordingMutex.Lock()
	defer a.recordingMutex.Unlock()

	if !a.isTranscribing {
		return "Not transcribing"
	}

	a.isTranscribing = false

	// Get audio samples
	samples := a.audioService.GetSamples()

	// Stop audio capture
	a.audioService.Stop()

	// Emit overlay:hide event
	if a.app != nil {
		a.app.Event.Emit("overlay:hide", nil)
	}

	if len(samples) == 0 {
		slog.Warn("no audio samples captured")
		return "No audio captured"
	}

	slog.Info("processing audio", "samples", len(samples))

	// Process transcription (this emits transcription-segment events)
	text, lang, err := a.transcriptionService.Process(samples, a.ctx)
	if err != nil {
		slog.Error("transcription failed", "error", err)
		return "Transcription failed: " + err.Error()
	}

	slog.Info("transcription complete", "text", text, "language", lang)

	// Note: transcription-complete event is already emitted by TranscriptionService.Process()
	// The frontend AI SDK agent listens for that event and handles LLM processing

	return text
}

// IsTranscribing returns whether transcription is currently active
func (a *App) IsTranscribing() bool {
	a.recordingMutex.Lock()
	defer a.recordingMutex.Unlock()
	return a.isTranscribing
}

// #region Continuous Conversation Mode (VAD-based)

// startContinuousListening begins continuous voice activity detection
// This enables natural conversation flow where users speak, pause, and the system
// automatically processes their speech when silence is detected
func (a *App) startContinuousListening() {
	a.continuousStateMutex.Lock()
	if a.continuousMode {
		a.continuousStateMutex.Unlock()
		return
	}
	a.continuousMode = true
	a.continuousState = ConversationStateListening
	a.continuousStateMutex.Unlock()

	// Start conversation mode if not already active
	if !a.isConversationMode {
		a.StartConversation()
	}

	// Set up VAD callbacks
	a.vadService.SetCallbacks(
		a.onVADSpeechStart,
		a.onVADSpeechEnd,
	)

	// Set up audio streaming to VAD
	a.audioService.SetStreamCallback(func(samples []float32) {
		a.vadService.ProcessSamples(samples)
	})

	// Start audio capture
	if err := a.audioService.Start(); err != nil {
		slog.Error("[ContinuousMode] Failed to start audio capture", "error", err)
		a.continuousStateMutex.Lock()
		a.continuousMode = false
		a.continuousState = ConversationStateIdle
		a.continuousStateMutex.Unlock()
		return
	}

	// Start VAD
	a.vadService.Start()

	// Emit event to frontend
	if a.app != nil {
		a.app.Event.Emit("conversation:listening-started", nil)
	}

	slog.Info("[ContinuousMode] Started continuous listening")
}

// stopContinuousListening stops the continuous listening mode
func (a *App) stopContinuousListening() {
	a.continuousStateMutex.Lock()
	if !a.continuousMode {
		a.continuousStateMutex.Unlock()
		return
	}
	a.continuousMode = false
	a.continuousState = ConversationStateIdle
	a.continuousStateMutex.Unlock()

	// Stop VAD first
	a.vadService.Stop()

	// Clear stream callback
	a.audioService.ClearStreamCallback()

	// Stop audio capture
	a.audioService.Stop()

	// Emit event to frontend
	if a.app != nil {
		a.app.Event.Emit("conversation:listening-stopped", nil)
	}

	slog.Info("[ContinuousMode] Stopped continuous listening")
}

// onVADSpeechStart is called when VAD detects speech starting
func (a *App) onVADSpeechStart() {
	a.continuousStateMutex.Lock()
	if a.continuousState != ConversationStateListening {
		a.continuousStateMutex.Unlock()
		return
	}
	a.continuousStateMutex.Unlock()

	slog.Debug("[ContinuousMode] Speech detected")

	// Emit event to frontend for visual feedback
	if a.app != nil {
		a.app.Event.Emit("conversation:speech-detected", nil)
	}
}

// onVADSpeechEnd is called when VAD detects speech ending (silence threshold reached)
func (a *App) onVADSpeechEnd(samples []float32) {
	a.continuousStateMutex.Lock()
	// Only process if we're in listening state and not already processing
	if a.continuousState != ConversationStateListening {
		a.continuousStateMutex.Unlock()
		slog.Debug("[ContinuousMode] Ignoring speech end, not in listening state", "state", a.continuousState)
		return
	}
	a.continuousState = ConversationStateProcessing
	a.continuousStateMutex.Unlock()

	slog.Info("[ContinuousMode] Speech ended, processing", "samples", len(samples))

	// Emit processing state to frontend
	if a.app != nil {
		a.app.Event.Emit("conversation:processing", nil)
	}

	// Pause VAD during processing to avoid picking up TTS audio
	a.vadService.Pause()

	// Process the speech samples
	go a.processContinuousSpeech(samples)
}

// processContinuousSpeech transcribes and processes speech from continuous mode
func (a *App) processContinuousSpeech(samples []float32) {
	if len(samples) == 0 {
		a.resumeListening()
		return
	}

	// Transcribe the audio
	text, lang, err := a.transcriptionService.Process(samples, a.ctx)
	if err != nil {
		slog.Error("[ContinuousMode] Transcription failed", "error", err)
		a.resumeListening()
		return
	}

	if text == "" {
		slog.Debug("[ContinuousMode] Empty transcription, resuming listening")
		a.resumeListening()
		return
	}

	slog.Info("[ContinuousMode] Transcribed", "text", text, "language", lang)

	// Note: transcription-complete event is already emitted by TranscriptionService.Process()
	// The frontend AI SDK agent listens for that event and handles LLM processing

	// Keep VAD paused - frontend will call ResumeListening after TTS completes
	// Update state to processing (frontend is handling it)
	a.continuousStateMutex.Lock()
	a.continuousState = ConversationStateProcessing
	a.continuousStateMutex.Unlock()
}

// processConversationWithCallback processes a conversation turn and calls the callback when done
func (a *App) processConversationWithCallback(text string, onComplete func()) {
	if text == "" {
		onComplete()
		return
	}

	slog.Info("[Conversation] Processing user input", "text", text)

	// Emit user message to frontend
	if a.app != nil {
		a.app.Event.Emit("conversation:user-message", map[string]interface{}{
			"text": text,
		})
	}

	// Append user message to history
	a.conversationHistory = append(a.conversationHistory, gemini.ChatMessage{
		Role:    "user",
		Content: text,
	})

	// Trim history to max turns (keep system prompt + last N turn pairs)
	maxMessages := 1 + gemini.MaxConversationTurns*2 // system + N*(user+assistant)
	if len(a.conversationHistory) > maxMessages {
		a.conversationHistory = append(
			a.conversationHistory[:1],
			a.conversationHistory[len(a.conversationHistory)-maxMessages+1:]...,
		)
	}

	// Signal thinking
	if a.app != nil {
		a.app.Event.Emit("conversation:thinking", nil)
	}

	// Call Gemini
	if a.geminiService == nil || !a.geminiService.IsConfigured() {
		a.emitConversationError("Gemini API key not configured")
		onComplete()
		return
	}

	response, err := a.geminiService.Chat(a.conversationHistory)
	if err != nil {
		a.emitConversationError(fmt.Sprintf("Gemini error: %v", err))
		onComplete()
		return
	}

	// Append assistant response to history
	a.conversationHistory = append(a.conversationHistory, gemini.ChatMessage{
		Role:    "assistant",
		Content: response,
	})

	// Synthesize TTS via ElevenLabs
	var audioBase64 string
	var audioDuration time.Duration
	if a.elevenlabsService != nil && a.elevenlabsService.IsConfigured() {
		mp3Bytes, err := a.elevenlabsService.Synthesize(response)
		if err != nil {
			slog.Warn("[Conversation] ElevenLabs TTS error (falling back to text-only)", "error", err)
		} else {
			audioBase64 = base64.StdEncoding.EncodeToString(mp3Bytes)
			// Estimate audio duration (rough estimate: ~150 words per minute, ~5 chars per word)
			wordCount := float64(len(response)) / 5.0
			audioDuration = time.Duration(wordCount/150.0*60.0) * time.Second
			if audioDuration < time.Second {
				audioDuration = time.Second
			}
		}
	} else {
		slog.Info("[Conversation] ElevenLabs not configured, sending text-only response")
	}

	// Emit response to frontend
	if a.app != nil {
		payload := map[string]interface{}{
			"text": response,
		}
		if audioBase64 != "" {
			payload["audio"] = audioBase64
		}
		a.app.Event.Emit("conversation:response", payload)
	}

	slog.Info("[Conversation] Response sent", "text", response, "hasAudio", audioBase64 != "")

	// Wait for audio playback to complete before resuming listening
	// Add a small buffer to ensure audio finishes
	if audioDuration > 0 {
		go func() {
			time.Sleep(audioDuration + 500*time.Millisecond)
			onComplete()
		}()
	} else {
		// No audio, resume immediately after a short delay
		go func() {
			time.Sleep(500 * time.Millisecond)
			onComplete()
		}()
	}
}

// resumeListening resumes listening after processing/speaking is complete
func (a *App) resumeListening() {
	a.continuousStateMutex.Lock()
	if !a.continuousMode {
		a.continuousStateMutex.Unlock()
		return
	}
	a.continuousState = ConversationStateListening
	a.continuousStateMutex.Unlock()

	// Resume VAD
	a.vadService.Resume()

	// Emit event to frontend
	if a.app != nil {
		a.app.Event.Emit("conversation:listening-resumed", nil)
	}

	slog.Info("[ContinuousMode] Resumed listening")
}

// GetContinuousState returns the current continuous conversation state
func (a *App) GetContinuousState() string {
	a.continuousStateMutex.Lock()
	defer a.continuousStateMutex.Unlock()
	return string(a.continuousState)
}

// IsContinuousMode returns whether continuous listening mode is active
func (a *App) IsContinuousMode() bool {
	a.continuousStateMutex.Lock()
	defer a.continuousStateMutex.Unlock()
	return a.continuousMode
}

// PauseListening pauses the VAD to prevent picking up TTS audio
// Called by frontend when agent starts speaking
func (a *App) PauseListening() {
	if a.vadService != nil {
		a.vadService.Pause()
		slog.Info("[ContinuousMode] Listening paused by frontend")
	}
}

// ResumeListening resumes the VAD after TTS playback is complete
// Called by frontend when agent finishes speaking
func (a *App) ResumeListening() {
	if a.vadService != nil {
		a.vadService.Resume()
		slog.Info("[ContinuousMode] Listening resumed by frontend")
	}

	// Update state and emit event for overlay
	a.continuousStateMutex.Lock()
	a.continuousState = ConversationStateListening
	a.continuousStateMutex.Unlock()

	if a.app != nil {
		a.app.Event.Emit("conversation:listening-resumed", nil)
	}
}

// #endregion Continuous Conversation Mode

// IsReady returns whether the transcription service is initialized
func (a *App) IsReady() bool {
	return a.transcriptionService.IsInitialized()
}

// GetLanguages returns supported transcription languages
func (a *App) GetLanguages() []string {
	return a.transcriptionService.GetLanguages()
}

// SetSelectedLanguage sets the language for transcription
func (a *App) SetSelectedLanguage(language string) error {
	return a.transcriptionService.SetLanguage(language)
}

// DownloadModel downloads a whisper model
func (a *App) DownloadModel(modelName string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	return a.transcriptionService.DownloadModel(ctx, modelName)
}

// listModels returns available whisper models (not exposed to frontend)
func (a *App) listModels() []transcription.ModelInfo {
	return a.transcriptionService.ListModels()
}

// Greet returns a greeting message - example method exposed to frontend
func (a *App) Greet(name string) string {
	if name == "" {
		return "Hello, World!"
	}
	return "Hello, " + name + "!"
}

// CheckAccessibility checks if accessibility permission is granted
func (a *App) CheckAccessibility() bool {
	if a.permissionsService == nil {
		return false
	}
	return a.permissionsService.CheckAccessibility() == permissions.StatusGranted
}

// OpenAccessibilitySettings opens System Settings to the Accessibility pane
func (a *App) OpenAccessibilitySettings() {
	if a.permissionsService != nil {
		a.permissionsService.OpenAccessibilitySettings()
	}
}

// CheckMicrophone checks the microphone permission status
// Returns: "granted", "denied", "not_asked", "restricted", "unknown"
func (a *App) CheckMicrophone() string {
	if a.permissionsService == nil {
		return "unknown"
	}
	return string(a.permissionsService.CheckMicrophone())
}

// RequestMicrophonePermission triggers the system microphone permission dialog
func (a *App) RequestMicrophonePermission() {
	if a.permissionsService != nil {
		a.permissionsService.RequestMicrophonePermission()
	}
}

// OpenMicrophoneSettings opens System Settings to the Microphone pane
func (a *App) OpenMicrophoneSettings() {
	if a.permissionsService != nil {
		a.permissionsService.OpenMicrophoneSettings()
	}
}

// #region Conversation Mode (Voice Chat with 3D Avatar)

// StartConversation enters conversation mode. In this mode, hotkey-triggered
// transcriptions are routed to the LLM for a conversational reply, which is
// then synthesized to speech via TTS and sent to the frontend for playback.
func (a *App) StartConversation() string {
	a.isConversationMode = true
	a.conversationHistory = []gemini.ChatMessage{
		{Role: "system", Content: gemini.ConversationSystemPrompt},
	}

	slog.Info("[Conversation] Mode started")
	return "Conversation started"
}

// StopConversation exits conversation mode and clears history.
func (a *App) StopConversation() string {
	a.isConversationMode = false
	a.conversationHistory = nil
	slog.Info("[Conversation] Mode stopped")
	return "Conversation stopped"
}

// IsConversationMode returns whether conversation mode is active.
func (a *App) IsConversationMode() bool {
	return a.isConversationMode
}

// ProcessVoiceInput takes a transcribed user message, sends it to the LLM,
// synthesizes the response with TTS, and emits events for the frontend.
func (a *App) ProcessVoiceInput(text string) {
	if text == "" {
		return
	}

	slog.Info("[Conversation] Processing user input", "text", text)

	// Emit user message to frontend
	if a.app != nil {
		a.app.Event.Emit("conversation:user-message", map[string]interface{}{
			"text": text,
		})
	}

	// Append user message to history
	a.conversationHistory = append(a.conversationHistory, gemini.ChatMessage{
		Role:    "user",
		Content: text,
	})

	// Trim history to max turns (keep system prompt + last N turn pairs)
	maxMessages := 1 + gemini.MaxConversationTurns*2 // system + N*(user+assistant)
	if len(a.conversationHistory) > maxMessages {
		// Keep system prompt and trim oldest turns
		a.conversationHistory = append(
			a.conversationHistory[:1],
			a.conversationHistory[len(a.conversationHistory)-maxMessages+1:]...,
		)
	}

	// Signal thinking
	if a.app != nil {
		a.app.Event.Emit("conversation:thinking", nil)
	}

	// Call Gemini
	if a.geminiService == nil || !a.geminiService.IsConfigured() {
		a.emitConversationError("Gemini API key not configured")
		return
	}

	response, err := a.geminiService.Chat(a.conversationHistory)
	if err != nil {
		a.emitConversationError(fmt.Sprintf("Gemini error: %v", err))
		return
	}

	// Append assistant response to history
	a.conversationHistory = append(a.conversationHistory, gemini.ChatMessage{
		Role:    "assistant",
		Content: response,
	})

	// Synthesize TTS via ElevenLabs
	var audioBase64 string
	if a.elevenlabsService != nil && a.elevenlabsService.IsConfigured() {
		mp3Bytes, err := a.elevenlabsService.Synthesize(response)
		if err != nil {
			slog.Warn("[Conversation] ElevenLabs TTS error (falling back to text-only)", "error", err)
		} else {
			audioBase64 = base64.StdEncoding.EncodeToString(mp3Bytes)
		}
	} else {
		slog.Info("[Conversation] ElevenLabs not configured, sending text-only response")
	}

	// Emit response to frontend
	if a.app != nil {
		payload := map[string]interface{}{
			"text": response,
		}
		if audioBase64 != "" {
			payload["audio"] = audioBase64
		}
		a.app.Event.Emit("conversation:response", payload)
	}

	slog.Info("[Conversation] Response sent", "text", response, "hasAudio", audioBase64 != "")
}

// emitConversationError sends an error event to the frontend.
func (a *App) emitConversationError(msg string) {
	slog.Error("[Conversation] Error", "message", msg)
	if a.app != nil {
		a.app.Event.Emit("conversation:error", map[string]interface{}{
			"error": msg,
		})
	}
}

// IsConversationConfigured returns whether the voice chat APIs are configured.
func (a *App) IsConversationConfigured() bool {
	return a.geminiService != nil && a.geminiService.IsConfigured()
}

// #endregion Conversation Mode

// #region Settings API

// GetSettings returns the current application settings.
func (a *App) GetSettings() settings.Settings {
	if a.settingsService == nil {
		return settings.Settings{}
	}
	return a.settingsService.GetSettings()
}

// SetGeminiAPIKey updates the Gemini API key in settings and service.
func (a *App) SetGeminiAPIKey(key string) string {
	if a.geminiService != nil {
		a.geminiService.SetAPIKey(key)
	}
	if a.settingsService != nil {
		if err := a.settingsService.SetGeminiAPIKey(key); err != nil {
			return fmt.Sprintf("Failed to save: %v", err)
		}
	}
	return ""
}

// SetElevenLabsAPIKey updates the ElevenLabs API key in settings and service.
func (a *App) SetElevenLabsAPIKey(key string) string {
	if a.elevenlabsService != nil {
		a.elevenlabsService.SetAPIKey(key)
	}
	if a.settingsService != nil {
		if err := a.settingsService.SetElevenLabsAPIKey(key); err != nil {
			return fmt.Sprintf("Failed to save: %v", err)
		}
	}
	return ""
}

// SetElevenLabsVoiceID updates the ElevenLabs voice ID in settings and service.
func (a *App) SetElevenLabsVoiceID(voiceID string) string {
	if a.elevenlabsService != nil {
		a.elevenlabsService.SetVoiceID(voiceID)
	}
	if a.settingsService != nil {
		if err := a.settingsService.SetElevenLabsVoiceID(voiceID); err != nil {
			return fmt.Sprintf("Failed to save: %v", err)
		}
	}
	return ""
}

// SetSilenceDurationMs updates the silence duration for VAD in settings and service.
func (a *App) SetSilenceDurationMs(durationMs int) string {
	// Update VAD service immediately
	if a.vadService != nil {
		a.vadService.SetSilenceDuration(time.Duration(durationMs) * time.Millisecond)
	}
	// Persist to settings
	if a.settingsService != nil {
		if err := a.settingsService.SetSilenceDurationMs(durationMs); err != nil {
			return fmt.Sprintf("Failed to save: %v", err)
		}
	}
	return ""
}

// GetSilenceDurationMs returns the current silence duration setting.
func (a *App) GetSilenceDurationMs() int {
	if a.settingsService != nil {
		return a.settingsService.GetSilenceDurationMs()
	}
	return settings.DefaultSilenceDurationMs
}

// #endregion Settings API

// #region TTS API

// SynthesizeSpeech takes text and returns base64-encoded audio.
// This is used by the frontend agent to synthesize speech independently
// of the conversation flow.
func (a *App) SynthesizeSpeech(text string) (string, error) {
	if text == "" {
		return "", fmt.Errorf("empty text provided")
	}

	if a.elevenlabsService == nil || !a.elevenlabsService.IsConfigured() {
		return "", fmt.Errorf("ElevenLabs not configured")
	}

	mp3Bytes, err := a.elevenlabsService.Synthesize(text)
	if err != nil {
		slog.Error("[TTS] Synthesis failed", "error", err)
		return "", fmt.Errorf("synthesis failed: %w", err)
	}

	audioBase64 := base64.StdEncoding.EncodeToString(mp3Bytes)
	slog.Info("[TTS] Synthesized speech", "textLength", len(text), "audioBytes", len(mp3Bytes))

	return audioBase64, nil
}

// IsTTSConfigured returns whether the TTS service (ElevenLabs) is configured.
func (a *App) IsTTSConfigured() bool {
	return a.elevenlabsService != nil && a.elevenlabsService.IsConfigured()
}

// #endregion TTS API
