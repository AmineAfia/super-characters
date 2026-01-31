package hotkey

import (
	"log/slog"
	"sync"
	"time"
)

// ModeHandler encapsulates the mode-specific logic for hotkey handling
// This separates PTT (Push-to-Talk) vs Toggle mode behavior from the service
type ModeHandler struct {
	mode           HotkeyMode
	isActive       bool      // Whether transcription is currently active
	isHeldDown     bool      // Whether the hotkey is currently being held
	holdStartTime  time.Time // When the key was pressed
	handsFreeMode  bool      // Whether hands-free mode is active

	// Callbacks for actions
	onStartAction      func()
	onStopAction       func()
	onHandsFreeToggle  func(enabled bool)

	mu sync.Mutex
}

// NewModeHandler creates a new mode handler with the specified mode
func NewModeHandler(mode HotkeyMode) *ModeHandler {
	return &ModeHandler{
		mode: mode,
	}
}

// SetMode updates the hotkey behavior mode
func (h *ModeHandler) SetMode(mode HotkeyMode) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.mode = mode
}

// GetMode returns the current hotkey mode
func (h *ModeHandler) GetMode() HotkeyMode {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.mode
}

// SetCallbacks sets the action callbacks
func (h *ModeHandler) SetCallbacks(onStart, onStop func(), onHandsFree func(enabled bool)) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.onStartAction = onStart
	h.onStopAction = onStop
	h.onHandsFreeToggle = onHandsFree
}

// SetHandsFreeMode sets the hands-free mode state
func (h *ModeHandler) SetHandsFreeMode(enabled bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.handsFreeMode = enabled
}

// IsHandsFreeMode returns whether hands-free mode is active
func (h *ModeHandler) IsHandsFreeMode() bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.handsFreeMode
}

// IsHeldDown returns whether the hotkey is currently being held
func (h *ModeHandler) IsHeldDown() bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.isHeldDown
}

// HandleKeyDown processes key press events based on the current mode
func (h *ModeHandler) HandleKeyDown(bindingID string) {
	h.mu.Lock()
	mode := h.mode
	wasHeldDown := h.isHeldDown
	handsFree := h.handsFreeMode
	onStart := h.onStartAction
	onStop := h.onStopAction
	h.mu.Unlock()

	// In hands-free mode, pressing the hotkey stops recording
	if handsFree {
		slog.Info("hotkey pressed in hands-free mode, stopping")
		h.mu.Lock()
		h.handsFreeMode = false
		h.mu.Unlock()
		if onStop != nil {
			onStop()
		}
		return
	}

	switch mode {
	case ModeHoldToTalk:
		if !wasHeldDown {
			h.mu.Lock()
			h.isHeldDown = true
			h.holdStartTime = time.Now()
			h.mu.Unlock()

			if onStart != nil {
				onStart()
			}
		}
		// If already held down, ignore (debounce)

	case ModeToggle:
		if !wasHeldDown {
			h.mu.Lock()
			h.isHeldDown = true
			h.isActive = !h.isActive
			shouldStart := h.isActive
			h.mu.Unlock()

			if shouldStart {
				if onStart != nil {
					onStart()
				}
			} else {
				if onStop != nil {
					onStop()
				}
			}
		}
	}
}

// HandleKeyUp processes key release events based on the current mode
func (h *ModeHandler) HandleKeyUp(bindingID string) {
	h.mu.Lock()
	mode := h.mode
	wasHeldDown := h.isHeldDown
	handsFree := h.handsFreeMode
	onStop := h.onStopAction
	h.isHeldDown = false
	h.mu.Unlock()

	// Ignore key up in hands-free mode
	if handsFree {
		return
	}

	switch mode {
	case ModeHoldToTalk:
		if wasHeldDown {
			if onStop != nil {
				onStop()
			}
		}

	case ModeToggle:
		// In toggle mode, key up does nothing (state was toggled on key down)
	}
}

// HandleHandsFreeToggle processes hands-free toggle events
func (h *ModeHandler) HandleHandsFreeToggle() {
	h.mu.Lock()
	wasHandsFree := h.handsFreeMode
	h.handsFreeMode = !h.handsFreeMode
	enabled := h.handsFreeMode
	callback := h.onHandsFreeToggle
	h.mu.Unlock()

	slog.Info("hands-free mode toggled", "from", wasHandsFree, "to", enabled)

	if callback != nil {
		callback(enabled)
	}
}

// Reset clears all state (useful when stopping the service)
func (h *ModeHandler) Reset() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.isActive = false
	h.isHeldDown = false
	h.handsFreeMode = false
}
