package hotkey

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
)

// HotkeyCallback is the function signature for hotkey press callbacks
type HotkeyCallback func()

// HotkeyMode defines how the hotkey behaves
type HotkeyMode int

const (
	// ModeToggle - press to start, press again to stop
	ModeToggle HotkeyMode = iota
	// ModeHoldToTalk - hold to record, release to stop
	ModeHoldToTalk
)

// HotkeyService manages global hotkey registration
type HotkeyService struct {
	ctx        context.Context
	cancel     context.CancelFunc
	registered bool

	// Mode handler for PTT/Toggle logic
	handler *ModeHandler

	// Legacy callbacks (used by handler)
	onPress    HotkeyCallback
	onRelease  HotkeyCallback
	onHandsFreeToggle func(enabled bool)

	// Recording mode
	recorder     KeyRecorder
	isRecording  bool
	recordingMu  sync.Mutex

	mu sync.Mutex
}

// NewHotkeyService creates a new hotkey service
func NewHotkeyService() *HotkeyService {
	handler := NewModeHandler(ModeHoldToTalk)
	return &HotkeyService{
		handler: handler,
	}
}

// SetMode sets the hotkey behavior mode
func (s *HotkeyService) SetMode(mode HotkeyMode) {
	s.handler.SetMode(mode)
}

// GetMode returns the current hotkey mode
func (s *HotkeyService) GetMode() HotkeyMode {
	return s.handler.GetMode()
}

// SetHandsFreeCallback sets the callback for hands-free mode toggle
func (s *HotkeyService) SetHandsFreeCallback(callback func(enabled bool)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onHandsFreeToggle = callback
	s.handler.SetCallbacks(s.onPress, s.onRelease, callback)
}

// IsHandsFreeMode returns whether hands-free mode is active
func (s *HotkeyService) IsHandsFreeMode() bool {
	return s.handler.IsHandsFreeMode()
}

// SetHandsFreeMode manually sets hands-free mode state
func (s *HotkeyService) SetHandsFreeMode(enabled bool) {
	s.handler.SetHandsFreeMode(enabled)
}

// Start initializes and registers the global hotkeys for hold-to-talk
func (s *HotkeyService) Start(ctx context.Context, hotkeyStr string, onPress HotkeyCallback) error {
	return s.StartWithRelease(ctx, hotkeyStr, "", onPress, nil)
}

// StartWithRelease initializes hotkeys with both press and release callbacks
func (s *HotkeyService) StartWithRelease(ctx context.Context, hotkeyStr string, handsFreeHotkeyStr string, onPress, onRelease HotkeyCallback) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.registered {
		return fmt.Errorf("hotkey already registered")
	}

	s.ctx, s.cancel = context.WithCancel(ctx)
	s.onPress = onPress
	s.onRelease = onRelease

	// Configure the handler with callbacks
	s.handler.SetCallbacks(onPress, onRelease, s.onHandsFreeToggle)

	// Start the event tap with channel-based approach
	if err := startTapWithChannel(hotkeyStr, handsFreeHotkeyStr); err != nil {
		return fmt.Errorf("failed to start event tap: %w", err)
	}

	// Start the event processing loop
	go s.eventLoop(s.ctx)

	s.registered = true
	slog.Info("global hotkey registered via tap", "hotkey", hotkeyStr)

	return nil
}

// eventLoop processes hotkey events from the channel
func (s *HotkeyService) eventLoop(ctx context.Context) {
	eventChan := GetEventChannel()

	for {
		select {
		case <-ctx.Done():
			slog.Info("hotkey event loop stopped")
			return

		case event := <-eventChan:
			s.processEvent(event)
		}
	}
}

// processEvent handles a single hotkey event
func (s *HotkeyService) processEvent(event HotkeyEvent) {
	switch event.Type {
	case EventPress:
		s.handler.HandleKeyDown("main")

	case EventRelease:
		s.handler.HandleKeyUp("main")

	case EventHandsFreeToggle:
		// Execute on a separate goroutine to avoid blocking
		go s.handler.HandleHandsFreeToggle()
	}
}

// ToggleHandsFreeMode toggles hands-free recording mode
func (s *HotkeyService) ToggleHandsFreeMode() {
	s.handler.HandleHandsFreeToggle()
}

// Stop unregisters the global hotkey and stops listening
func (s *HotkeyService) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.registered {
		return
	}

	if s.cancel != nil {
		s.cancel()
	}

	stopTap()
	s.handler.Reset()

	s.registered = false
	slog.Info("global hotkey unregistered")
}

// IsRegistered returns whether the hotkey is currently registered
func (s *HotkeyService) IsRegistered() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.registered
}

// IsHeldDown returns whether the hotkey is currently being held
func (s *HotkeyService) IsHeldDown() bool {
	return s.handler.IsHeldDown()
}

// StartRecording starts native keyboard recording mode
// This is used by the frontend to capture hotkey combinations
func (s *HotkeyService) StartRecording() error {
	return s.StartRecordingWithEmitter(nil)
}

// StartRecordingWithEmitter starts native keyboard recording mode with an event emitter
// The emitter allows direct event emission to the frontend, bypassing the channel
func (s *HotkeyService) StartRecordingWithEmitter(emitter EventEmitter) error {
	s.recordingMu.Lock()
	defer s.recordingMu.Unlock()

	if s.isRecording {
		return fmt.Errorf("recording already in progress")
	}

	// Create a new recorder
	recorder := NewDarwinKeyRecorder()

	// Set the emitter if provided for direct frontend communication
	if emitter != nil {
		recorder.SetEmitter(emitter)
	}

	if err := recorder.Start(); err != nil {
		return fmt.Errorf("failed to start recorder: %w", err)
	}

	s.recorder = recorder
	s.isRecording = true
	return nil
}

// StopRecording stops native keyboard recording mode
func (s *HotkeyService) StopRecording() {
	s.recordingMu.Lock()
	defer s.recordingMu.Unlock()

	if !s.isRecording || s.recorder == nil {
		return
	}

	s.recorder.Stop()
	s.recorder = nil
	s.isRecording = false
}

// IsRecording returns whether recording mode is active
func (s *HotkeyService) IsRecording() bool {
	s.recordingMu.Lock()
	defer s.recordingMu.Unlock()
	return s.isRecording
}

// GetRecordingChannel returns the channel for receiving recorded key events
// Returns nil if not recording
func (s *HotkeyService) GetRecordingChannel() <-chan RecordedKeyEvent {
	s.recordingMu.Lock()
	defer s.recordingMu.Unlock()

	if s.recorder == nil {
		return nil
	}
	return s.recorder.Events()
}
