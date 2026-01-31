package hotkey

/*
#cgo LDFLAGS: -framework CoreGraphics -framework CoreFoundation
#include <ApplicationServices/ApplicationServices.h>

// Forward declaration
extern void goOnHotkeyEvent(int eventType, int bindingType);

static int targetKeyCode = -1;
static uint64_t targetFlags = 0;
static int handsFreeKeyCode = -1;
static uint64_t handsFreeFlags = 0;

// Track if this is a modifier-only hotkey
static int targetIsModifierOnly = 0;
static int handsFreeIsModifierOnly = 0;

// Track pressed state for modifier-only hotkeys
static int mainHotkeyPressed = 0;
static int handsFreeHotkeyPressed = 0;

static CFMachPortRef eventTap = NULL;
static CFRunLoopSourceRef runLoopSource = NULL;

// Event types for Go callback
#define EVENT_PRESS 1
#define EVENT_RELEASE 2
#define EVENT_HANDS_FREE_TOGGLE 3

// Binding types
#define BINDING_MAIN 1
#define BINDING_HANDS_FREE 2

// Check if a keycode is a modifier key
static int isModifierKeyCodeC(int keyCode) {
    // Modifier key codes from Carbon
    return keyCode == 0x38 || // Shift
           keyCode == 0x3C || // Right Shift
           keyCode == 0x3B || // Control
           keyCode == 0x3E || // Right Control
           keyCode == 0x3A || // Option
           keyCode == 0x3D || // Right Option
           keyCode == 0x37;   // Command
}

// Get the modifier flag for a given modifier keycode
static uint64_t getModifierFlag(int keyCode) {
    switch (keyCode) {
        case 0x38: case 0x3C: return kCGEventFlagMaskShift;    // Shift
        case 0x3B: case 0x3E: return kCGEventFlagMaskControl;  // Control
        case 0x3A: case 0x3D: return kCGEventFlagMaskAlternate; // Option
        case 0x37: return kCGEventFlagMaskCommand;              // Command
        default: return 0;
    }
}

// Callback
static CGEventRef eventCallback(CGEventTapProxy proxy, CGEventType type, CGEventRef event, void *refcon) {
    if (type == kCGEventTapDisabledByTimeout) {
        CGEventTapEnable(eventTap, true);
        return event;
    }

    uint64_t mask = kCGEventFlagMaskCommand | kCGEventFlagMaskShift | kCGEventFlagMaskAlternate | kCGEventFlagMaskControl;
    CGEventFlags flags = CGEventGetFlags(event);
    uint64_t currentFlags = flags & mask;

    // Handle modifier-only hotkeys via flagsChanged events
    if (type == kCGEventFlagsChanged) {
        // For modifier-only hotkeys, we check if all required flags are set
        // Main hotkey (modifier-only)
        if (targetIsModifierOnly) {
            // Calculate the flags we need (excluding the trigger key's own flag)
            uint64_t triggerFlag = getModifierFlag(targetKeyCode);
            uint64_t requiredFlags = targetFlags & ~triggerFlag; // Other modifiers that must be held

            // Check if all required modifiers are pressed AND the trigger modifier is pressed
            int allFlagsMatch = (currentFlags & targetFlags) == targetFlags;

            if (allFlagsMatch && !mainHotkeyPressed) {
                mainHotkeyPressed = 1;
                goOnHotkeyEvent(EVENT_PRESS, BINDING_MAIN);
                return NULL; // Suppress
            } else if (!allFlagsMatch && mainHotkeyPressed) {
                mainHotkeyPressed = 0;
                goOnHotkeyEvent(EVENT_RELEASE, BINDING_MAIN);
                return NULL; // Suppress
            }
        }

        // Hands-free hotkey (modifier-only)
        if (handsFreeIsModifierOnly && handsFreeKeyCode != -1) {
            int allFlagsMatch = (currentFlags & handsFreeFlags) == handsFreeFlags;

            if (allFlagsMatch && !handsFreeHotkeyPressed) {
                handsFreeHotkeyPressed = 1;
                goOnHotkeyEvent(EVENT_HANDS_FREE_TOGGLE, BINDING_HANDS_FREE);
                return NULL; // Suppress
            } else if (!allFlagsMatch && handsFreeHotkeyPressed) {
                handsFreeHotkeyPressed = 0;
                // No release callback for hands-free (toggle only)
                return NULL;
            }
        }

        return event;
    }

    // Handle regular key events (keyDown/keyUp)
    if (type != kCGEventKeyDown && type != kCGEventKeyUp) {
        return event;
    }

    // Check for autorepeat
    int64_t isRepeat = CGEventGetIntegerValueField(event, kCGKeyboardEventAutorepeat);
    if (isRepeat != 0) {
        // If it's a repeat of our hotkey, suppress it but don't callback
        CGKeyCode keyCode = (CGKeyCode)CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode);

        if (!targetIsModifierOnly && keyCode == targetKeyCode && currentFlags == targetFlags) {
            return NULL; // Suppress repeat
        }
        if (!handsFreeIsModifierOnly && handsFreeKeyCode != -1 && keyCode == handsFreeKeyCode && currentFlags == handsFreeFlags) {
             return NULL; // Suppress repeat
        }
        return event;
    }

    CGKeyCode keyCode = (CGKeyCode)CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode);

    // Check main hotkey (non-modifier-only)
    if (!targetIsModifierOnly && keyCode == targetKeyCode && currentFlags == targetFlags) {
        if (type == kCGEventKeyDown) {
            goOnHotkeyEvent(EVENT_PRESS, BINDING_MAIN);
        } else {
            goOnHotkeyEvent(EVENT_RELEASE, BINDING_MAIN);
        }
        return NULL; // Suppress event
    }

    // Check hands-free hotkey (non-modifier-only)
    // Note: hands-free is toggle-only, so we trigger on press
    if (!handsFreeIsModifierOnly && handsFreeKeyCode != -1 && keyCode == handsFreeKeyCode && currentFlags == handsFreeFlags) {
        if (type == kCGEventKeyDown) {
            goOnHotkeyEvent(EVENT_HANDS_FREE_TOGGLE, BINDING_HANDS_FREE);
        }
        return NULL; // Suppress
    }

    return event;
}

static void stopTap() {
    // Reset state
    mainHotkeyPressed = 0;
    handsFreeHotkeyPressed = 0;

    if (runLoopSource) {
        CFRunLoopRemoveSource(CFRunLoopGetMain(), runLoopSource, kCFRunLoopCommonModes);
        CFRelease(runLoopSource);
        runLoopSource = NULL;
    }
    if (eventTap) {
        CFRelease(eventTap);
        eventTap = NULL;
    }
}

// Ensure unique name for start function in C to avoid conflicts
static int startTapC(int code, uint64_t flags, int isModOnly, int hfCode, uint64_t hfFlags, int hfIsModOnly) {
    targetKeyCode = code;
    targetFlags = flags;
    targetIsModifierOnly = isModOnly;
    handsFreeKeyCode = hfCode;
    handsFreeFlags = hfFlags;
    handsFreeIsModifierOnly = hfIsModOnly;

    // Reset pressed state
    mainHotkeyPressed = 0;
    handsFreeHotkeyPressed = 0;

    if (eventTap != NULL) return 0; // Already running

    // Include flagsChanged events for modifier-only hotkeys
    CGEventMask eventMask = CGEventMaskBit(kCGEventKeyDown) | CGEventMaskBit(kCGEventKeyUp) | CGEventMaskBit(kCGEventFlagsChanged);

    // Create event tap
    // kCGSessionEventTap puts us at the session level (like user input)
    // kCGHeadInsertEventTap puts us at the start of the chain
    eventTap = CGEventTapCreate(kCGSessionEventTap, kCGHeadInsertEventTap, 0, eventMask, eventCallback, NULL);

    if (!eventTap) {
        return -1; // Failed (likely permissions)
    }

    runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0);
    CFRunLoopAddSource(CFRunLoopGetMain(), runLoopSource, kCFRunLoopCommonModes);
    CGEventTapEnable(eventTap, true);

    return 0;
}
*/
import "C"
import (
	"fmt"
	"log/slog"
	"runtime"
	"strings"
	"sync"
	"time"
)

// HotkeyEventType represents the type of hotkey event
type HotkeyEventType int

const (
	EventPress HotkeyEventType = iota + 1
	EventRelease
	EventHandsFreeToggle
)

// BindingType represents which hotkey binding triggered the event
type BindingType int

const (
	BindingMain BindingType = iota + 1
	BindingHandsFree
)

// HotkeyEvent represents an event from the hotkey tap
type HotkeyEvent struct {
	Type        HotkeyEventType
	Binding     BindingType
	Timestamp   time.Time
}

// String returns a string representation of the event type
func (t HotkeyEventType) String() string {
	switch t {
	case EventPress:
		return "Press"
	case EventRelease:
		return "Release"
	case EventHandsFreeToggle:
		return "HandsFreeToggle"
	default:
		return "Unknown"
	}
}

var (
	// Channel for communicating events from C callbacks to Go
	hotkeyEventChan chan HotkeyEvent
	eventChanMu     sync.Mutex
)

// initEventChannel initializes the event channel if needed
func initEventChannel() {
	eventChanMu.Lock()
	defer eventChanMu.Unlock()
	if hotkeyEventChan == nil {
		hotkeyEventChan = make(chan HotkeyEvent, 100)
	}
}

// GetEventChannel returns the channel for receiving hotkey events
func GetEventChannel() <-chan HotkeyEvent {
	initEventChannel()
	return hotkeyEventChan
}

// drainEventChannel empties the event channel
func drainEventChannel() {
	eventChanMu.Lock()
	defer eventChanMu.Unlock()
	if hotkeyEventChan != nil {
		for len(hotkeyEventChan) > 0 {
			<-hotkeyEventChan
		}
	}
}

//export goOnHotkeyEvent
func goOnHotkeyEvent(eventType C.int, bindingType C.int) {
	initEventChannel()

	event := HotkeyEvent{
		Type:      HotkeyEventType(eventType),
		Binding:   BindingType(bindingType),
		Timestamp: time.Now(),
	}

	slog.Info("goOnHotkeyEvent called", "eventType", event.Type, "binding", event.Binding)

	// Non-blocking send to channel
	select {
	case hotkeyEventChan <- event:
		slog.Info("hotkey event sent to channel", "type", event.Type)
	default:
		// Channel full, log warning
		slog.Warn("hotkey event channel full, dropping event", "type", event.Type)
	}
}

func parseModifiers(hotkeyStr string) (uint64, error) {
	var flags uint64
	parts := strings.Split(hotkeyStr, "+")
	for _, p := range parts {
		switch strings.ToLower(strings.TrimSpace(p)) {
		case "cmd", "command":
			flags |= uint64(C.kCGEventFlagMaskCommand)
		case "shift":
			flags |= uint64(C.kCGEventFlagMaskShift)
		case "ctrl", "control":
			flags |= uint64(C.kCGEventFlagMaskControl)
		case "alt", "option":
			flags |= uint64(C.kCGEventFlagMaskAlternate)
		}
	}
	return flags, nil
}

func getKeyName(hotkeyStr string) string {
	parts := strings.Split(hotkeyStr, "+")
	if len(parts) > 0 {
		return strings.TrimSpace(parts[len(parts)-1])
	}
	return ""
}

// isModifierKey checks if the given keycode is a modifier key
func isModifierKey(keyCode int) bool {
	switch keyCode {
	case kVK_Shift, kVK_RightShift,
		kVK_Control, kVK_RightControl,
		kVK_Option, kVK_RightOption,
		kVK_Command:
		return true
	default:
		return false
	}
}

// startTapWithChannel starts the event tap and returns events via channel
// This is the preferred approach for new code
func startTapWithChannel(hotkeyStr string, handsFreeHotkeyStr string) error {
	// Initialize the event channel
	initEventChannel()
	drainEventChannel()

	// Lock to OS thread for CGo calls to ensure we're on the main thread
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	// Parse main hotkey
	flags, err := parseModifiers(hotkeyStr)
	if err != nil {
		return err
	}
	keyName := getKeyName(hotkeyStr)
	keyCode, ok := keyNameMap[keyName]
	if !ok {
		// Try uppercase
		keyCode, ok = keyNameMap[strings.ToUpper(keyName)]
		if !ok {
			return fmt.Errorf("unknown key: %s", keyName)
		}
	}

	// Check if this is a modifier-only hotkey
	isModOnly := isModifierKey(keyCode)

	// Parse hands-free hotkey
	var hfFlags uint64
	var hfCode int = -1
	var hfIsModOnly int = 0
	if handsFreeHotkeyStr != "" {
		hfFlags, _ = parseModifiers(handsFreeHotkeyStr)
		hfName := getKeyName(handsFreeHotkeyStr)
		if c, ok := keyNameMap[hfName]; ok {
			hfCode = c
			if isModifierKey(c) {
				hfIsModOnly = 1
			}
		} else if c, ok := keyNameMap[strings.ToUpper(hfName)]; ok {
			hfCode = c
			if isModifierKey(c) {
				hfIsModOnly = 1
			}
		}
	}

	var isModOnlyInt int = 0
	if isModOnly {
		isModOnlyInt = 1
	}

	res := C.startTapC(C.int(keyCode), C.uint64_t(flags), C.int(isModOnlyInt), C.int(hfCode), C.uint64_t(hfFlags), C.int(hfIsModOnly))
	if res != 0 {
		return fmt.Errorf("failed to create event tap (check permissions)")
	}

	return nil
}

func stopTap() {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.stopTap()
	drainEventChannel()
}
