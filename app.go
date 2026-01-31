package main

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"super-characters/audio"
	"super-characters/hotkey"
	"super-characters/permissions"
	"super-characters/transcription"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// App struct holds application state and dependencies
type App struct {
	app    *application.App
	window *application.WebviewWindow

	// Transcription services
	transcriptionService *transcription.TranscriptionService
	audioService         *audio.AudioService
	hotkeyService        *hotkey.HotkeyService
	permissionsService   *permissions.PermissionsService

	// Recording state
	isTranscribing bool
	recordingMutex sync.Mutex

	// Context for transcription
	ctx    context.Context
	cancel context.CancelFunc
}

// NewApp creates a new App instance
func NewApp() *App {
	permSvc, _ := permissions.NewPermissionsService()
	return &App{
		transcriptionService: transcription.NewTranscriptionService(),
		audioService:         audio.NewAudioService(),
		hotkeyService:        hotkey.NewHotkeyService(),
		permissionsService:   permSvc,
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

// ServiceStartup is called when the application starts (Wails v3 service interface)
func (a *App) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	a.ctx = ctx
	slog.Info("App service starting up")

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

	// Stop hotkey service
	a.hotkeyService.Stop()

	// Stop audio service
	a.audioService.Stop()

	// Close transcription service
	a.transcriptionService.Close()

	return nil
}

// RegisterHotkeys sets up the global hotkey after the app window is ready
func (a *App) RegisterHotkeys() {
	slog.Info("Registering global hotkeys")

	// Default hotkey: Cmd+Shift+Space
	hotkeyStr := "Cmd+Shift+Space"

	err := a.hotkeyService.StartWithRelease(
		a.ctx,
		hotkeyStr,
		"", // No hands-free hotkey for now
		a.onHotkeyPressed,
		a.onHotkeyReleased,
	)
	if err != nil {
		slog.Error("failed to register hotkey", "error", err)
	} else {
		slog.Info("global hotkey registered", "hotkey", hotkeyStr)
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
	return text
}

// IsTranscribing returns whether transcription is currently active
func (a *App) IsTranscribing() bool {
	a.recordingMutex.Lock()
	defer a.recordingMutex.Unlock()
	return a.isTranscribing
}

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
