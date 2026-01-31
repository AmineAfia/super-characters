package hotkey

// EventEmitter is an interface for emitting events to the frontend
// This allows the recorder to emit events directly without going through a channel
// The bool return value matches Wails EventManager.Emit signature
type EventEmitter interface {
	Emit(eventName string, data ...any) bool
}

// RecordedKeyEvent represents a keyboard event captured during recording mode
type RecordedKeyEvent struct {
	// Modifiers currently held (e.g., ["Ctrl", "Shift"])
	Modifiers []string `json:"modifiers"`
	// Key pressed (empty for modifier-only events)
	Key string `json:"key,omitempty"`
	// KeyCode is the platform-specific key code
	KeyCode int `json:"keyCode"`
	// IsKeyDown indicates if this is a key press (true) or release (false)
	IsKeyDown bool `json:"isKeyDown"`
	// HotkeyString is the formatted hotkey string (e.g., "Ctrl+Shift+A")
	HotkeyString string `json:"hotkeyString"`
	// IsComplete indicates if this represents a complete hotkey (all keys released)
	IsComplete bool `json:"isComplete"`
}

// KeyRecorder defines the interface for native keyboard event recording
type KeyRecorder interface {
	// Start begins recording keyboard events
	Start() error
	// Stop ends recording and cleans up resources
	Stop() error
	// Events returns a channel that receives recorded key events
	Events() <-chan RecordedKeyEvent
}

// FormatModifiers converts modifier flags to a slice of modifier names
func FormatModifiers(ctrl, shift, alt, cmd bool) []string {
	var modifiers []string
	if ctrl {
		modifiers = append(modifiers, "Ctrl")
	}
	if shift {
		modifiers = append(modifiers, "Shift")
	}
	if alt {
		modifiers = append(modifiers, "Alt")
	}
	if cmd {
		modifiers = append(modifiers, "Cmd")
	}
	return modifiers
}

// BuildHotkeyString constructs a hotkey string from modifiers and key
func BuildHotkeyString(modifiers []string, key string) string {
	if len(modifiers) == 0 && key == "" {
		return ""
	}

	result := ""
	for i, mod := range modifiers {
		if i > 0 {
			result += "+"
		}
		result += mod
	}

	if key != "" {
		if result != "" {
			result += "+"
		}
		result += key
	}

	return result
}
