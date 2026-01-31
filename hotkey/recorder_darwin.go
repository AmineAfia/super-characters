package hotkey

/*
#cgo LDFLAGS: -framework CoreGraphics -framework CoreFoundation
#include <ApplicationServices/ApplicationServices.h>

// Forward declarations for recorder callbacks
extern void goRecorderOnKeyEvent(int keyCode, uint64_t flags, int isDown);

static CFMachPortRef recorderEventTap = NULL;
static CFRunLoopSourceRef recorderRunLoopSource = NULL;

// Track which modifier keys are currently pressed for the recorder
static int recorderCtrlPressed = 0;
static int recorderShiftPressed = 0;
static int recorderAltPressed = 0;
static int recorderCmdPressed = 0;

// Callback for recording mode - listens without suppression
static CGEventRef recorderEventCallback(CGEventTapProxy proxy, CGEventType type, CGEventRef event, void *refcon) {
    if (type == kCGEventTapDisabledByTimeout) {
        CGEventTapEnable(recorderEventTap, true);
        return event;
    }

    CGKeyCode keyCode = 0;
    int isDown = 0;

    // Get current modifier flags
    CGEventFlags flags = CGEventGetFlags(event);

    if (type == kCGEventFlagsChanged) {
        // Handle modifier key changes
        keyCode = (CGKeyCode)CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode);

        // Determine if the modifier was pressed or released by comparing to tracked state
        uint64_t mask = kCGEventFlagMaskCommand | kCGEventFlagMaskShift | kCGEventFlagMaskAlternate | kCGEventFlagMaskControl;
        uint64_t currentFlags = flags & mask;

        // Check which modifier changed
        int newCtrl = (currentFlags & kCGEventFlagMaskControl) != 0;
        int newShift = (currentFlags & kCGEventFlagMaskShift) != 0;
        int newAlt = (currentFlags & kCGEventFlagMaskAlternate) != 0;
        int newCmd = (currentFlags & kCGEventFlagMaskCommand) != 0;

        // Determine if this is a press or release based on the change
        if (newCtrl != recorderCtrlPressed) {
            isDown = newCtrl;
            recorderCtrlPressed = newCtrl;
        } else if (newShift != recorderShiftPressed) {
            isDown = newShift;
            recorderShiftPressed = newShift;
        } else if (newAlt != recorderAltPressed) {
            isDown = newAlt;
            recorderAltPressed = newAlt;
        } else if (newCmd != recorderCmdPressed) {
            isDown = newCmd;
            recorderCmdPressed = newCmd;
        }

        goRecorderOnKeyEvent((int)keyCode, (uint64_t)flags, isDown);
    } else if (type == kCGEventKeyDown || type == kCGEventKeyUp) {
        // Skip autorepeat events
        int64_t isRepeat = CGEventGetIntegerValueField(event, kCGKeyboardEventAutorepeat);
        if (isRepeat != 0) {
            return event;
        }

        keyCode = (CGKeyCode)CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode);
        isDown = (type == kCGEventKeyDown) ? 1 : 0;

        goRecorderOnKeyEvent((int)keyCode, (uint64_t)flags, isDown);
    }

    // IMPORTANT: Return the event unchanged - we're only listening, not intercepting
    return event;
}

static int startRecorderTap() {
    if (recorderEventTap != NULL) {
        return 0; // Already running
    }

    // Reset modifier state
    recorderCtrlPressed = 0;
    recorderShiftPressed = 0;
    recorderAltPressed = 0;
    recorderCmdPressed = 0;

    CGEventMask eventMask = CGEventMaskBit(kCGEventKeyDown) |
                            CGEventMaskBit(kCGEventKeyUp) |
                            CGEventMaskBit(kCGEventFlagsChanged);

    // CRITICAL: Use kCGEventTapOptionListenOnly to observe without consuming events
    // This allows the system and other apps to still receive the key events
    recorderEventTap = CGEventTapCreate(
        kCGSessionEventTap,
        kCGHeadInsertEventTap,
        kCGEventTapOptionListenOnly,  // Listen only, don't suppress
        eventMask,
        recorderEventCallback,
        NULL
    );

    if (!recorderEventTap) {
        return -1; // Failed (likely permissions)
    }

    recorderRunLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, recorderEventTap, 0);
    CFRunLoopAddSource(CFRunLoopGetMain(), recorderRunLoopSource, kCFRunLoopCommonModes);
    CGEventTapEnable(recorderEventTap, true);

    return 0;
}

static void stopRecorderTap() {
    // Reset modifier state
    recorderCtrlPressed = 0;
    recorderShiftPressed = 0;
    recorderAltPressed = 0;
    recorderCmdPressed = 0;

    if (recorderRunLoopSource) {
        CFRunLoopRemoveSource(CFRunLoopGetMain(), recorderRunLoopSource, kCFRunLoopCommonModes);
        CFRelease(recorderRunLoopSource);
        recorderRunLoopSource = NULL;
    }
    if (recorderEventTap) {
        CFRelease(recorderEventTap);
        recorderEventTap = NULL;
    }
}
*/
import "C"
import (
	"fmt"
	"log/slog"
	"runtime"
	"sync"
)

// DarwinKeyRecorder implements KeyRecorder for macOS
type DarwinKeyRecorder struct {
	events    chan RecordedKeyEvent
	running   bool
	mu        sync.Mutex

	// Track currently held modifiers and keys for building complete hotkey
	heldModifiers map[string]bool
	heldKey       string
	heldKeyCode   int

	// Track the "peak" hotkey - the most complete hotkey pressed before release
	lastValidHotkey string

	// Optional event emitter for direct frontend communication
	emitter EventEmitter
}

var (
	// Global recorder instance for C callback access
	globalRecorder     *DarwinKeyRecorder
	globalRecorderLock sync.Mutex
)

// NewDarwinKeyRecorder creates a new macOS key recorder
func NewDarwinKeyRecorder() *DarwinKeyRecorder {
	return &DarwinKeyRecorder{
		events:        make(chan RecordedKeyEvent, 100),
		heldModifiers: make(map[string]bool),
	}
}

// SetEmitter sets the event emitter for direct frontend communication
func (r *DarwinKeyRecorder) SetEmitter(emitter EventEmitter) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.emitter = emitter
}

//export goRecorderOnKeyEvent
func goRecorderOnKeyEvent(keyCode C.int, flags C.uint64_t, isDown C.int) {
	globalRecorderLock.Lock()
	recorder := globalRecorder
	globalRecorderLock.Unlock()

	if recorder == nil {
		return
	}

	// CRITICAL: Dispatch to a goroutine because CGo callbacks run on OS threads,
	// not Go goroutines. Wails' EventManager.Emit requires a proper Go context.
	// Without this, events won't reach the frontend.
	go recorder.handleKeyEvent(int(keyCode), uint64(flags), isDown != 0)
}

func (r *DarwinKeyRecorder) handleKeyEvent(keyCode int, flags uint64, isDown bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if !r.running {
		return
	}

	// Parse modifier flags
	ctrl := (flags & uint64(C.kCGEventFlagMaskControl)) != 0
	shift := (flags & uint64(C.kCGEventFlagMaskShift)) != 0
	alt := (flags & uint64(C.kCGEventFlagMaskAlternate)) != 0
	cmd := (flags & uint64(C.kCGEventFlagMaskCommand)) != 0

	// Update held modifiers
	r.heldModifiers["Ctrl"] = ctrl
	r.heldModifiers["Shift"] = shift
	r.heldModifiers["Alt"] = alt
	r.heldModifiers["Cmd"] = cmd

	// Get key name from keycode
	keyName := getKeyNameFromCode(keyCode)
	isModifierKey := isModifierKeyCode(keyCode)

	// Track held non-modifier key
	if !isModifierKey {
		if isDown {
			r.heldKey = keyName
			r.heldKeyCode = keyCode
		} else {
			r.heldKey = ""
			r.heldKeyCode = 0
		}
	}

	// Build current modifier list
	modifiers := FormatModifiers(ctrl, shift, alt, cmd)

	// Determine the key for the event
	var eventKey string
	if !isModifierKey {
		eventKey = keyName
	}

	// Build hotkey string for current state
	hotkeyString := BuildHotkeyString(modifiers, eventKey)

	// Track the "peak" hotkey - update when we have a valid hotkey (at least one modifier)
	if isDown && len(modifiers) > 0 {
		r.lastValidHotkey = hotkeyString
	}

	// Check if this is a "complete" hotkey (user released all keys after pressing something)
	isComplete := false
	finalHotkeyString := hotkeyString

	if !isDown {
		// Check if all modifiers and keys are released
		if !ctrl && !shift && !alt && !cmd && r.heldKey == "" {
			isComplete = true
			// Use the last valid hotkey for the completion event
			if r.lastValidHotkey != "" {
				finalHotkeyString = r.lastValidHotkey
			}
		}
	}

	event := RecordedKeyEvent{
		Modifiers:    modifiers,
		Key:          eventKey,
		KeyCode:      keyCode,
		IsKeyDown:    isDown,
		HotkeyString: finalHotkeyString,
		IsComplete:   isComplete,
	}

	// Reset lastValidHotkey after sending complete event
	if isComplete {
		r.lastValidHotkey = ""
	}

	// Emit directly to frontend if emitter is set (more reliable than channel forwarding)
	if r.emitter != nil {
		r.emitter.Emit("hotkey:recording:event", map[string]interface{}{
			"modifiers":    event.Modifiers,
			"key":          event.Key,
			"keyCode":      event.KeyCode,
			"isKeyDown":    event.IsKeyDown,
			"hotkeyString": event.HotkeyString,
			"isComplete":   event.IsComplete,
		})
	}

	// Also send to channel for programmatic use (non-blocking)
	select {
	case r.events <- event:
	default:
		// Channel full, skip event (frontend is getting events via emitter anyway)
		if r.emitter == nil {
			slog.Warn("recorder event channel full, dropping event")
		}
	}
}

// Start begins recording keyboard events
func (r *DarwinKeyRecorder) Start() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.running {
		return fmt.Errorf("recorder already running")
	}

	// Set global reference for C callback
	globalRecorderLock.Lock()
	globalRecorder = r
	globalRecorderLock.Unlock()

	// Reset state
	r.heldModifiers = make(map[string]bool)
	r.heldKey = ""
	r.heldKeyCode = 0
	r.lastValidHotkey = ""

	// Drain any old events
	for len(r.events) > 0 {
		<-r.events
	}

	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	result := C.startRecorderTap()
	if result != 0 {
		globalRecorderLock.Lock()
		globalRecorder = nil
		globalRecorderLock.Unlock()
		return fmt.Errorf("failed to create recorder event tap (check accessibility permissions)")
	}

	r.running = true
	slog.Info("native hotkey recorder started")
	return nil
}

// Stop ends recording and cleans up resources
func (r *DarwinKeyRecorder) Stop() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if !r.running {
		return nil
	}

	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	C.stopRecorderTap()

	r.running = false

	globalRecorderLock.Lock()
	globalRecorder = nil
	globalRecorderLock.Unlock()

	slog.Info("native hotkey recorder stopped")
	return nil
}

// Events returns a channel that receives recorded key events
func (r *DarwinKeyRecorder) Events() <-chan RecordedKeyEvent {
	return r.events
}

// isModifierKeyCode checks if the keycode represents a modifier key
func isModifierKeyCode(keyCode int) bool {
	switch keyCode {
	case kVK_Shift, kVK_RightShift,
		kVK_Control, kVK_RightControl,
		kVK_Option, kVK_RightOption,
		kVK_Command, kVK_RightCommand:
		return true
	default:
		return false
	}
}

// getKeyNameFromCode converts a keycode to a readable key name
func getKeyNameFromCode(keyCode int) string {
	// Reverse lookup in keyNameMap
	for name, code := range keyNameMap {
		if code == keyCode {
			return name
		}
	}
	return fmt.Sprintf("Key%d", keyCode)
}
