package hotkey

// Key code constants from Carbon
const (
	kVK_ANSI_A = 0x00
	kVK_ANSI_S = 0x01
	kVK_ANSI_D = 0x02
	kVK_ANSI_F = 0x03
	kVK_ANSI_H = 0x04
	kVK_ANSI_G = 0x05
	kVK_ANSI_Z = 0x06
	kVK_ANSI_X = 0x07
	kVK_ANSI_C = 0x08
	kVK_ANSI_V = 0x09
	kVK_ANSI_B = 0x0B
	kVK_ANSI_Q = 0x0C
	kVK_ANSI_W = 0x0D
	kVK_ANSI_E = 0x0E
	kVK_ANSI_R = 0x0F
	kVK_ANSI_Y = 0x10
	kVK_ANSI_T = 0x11
	kVK_ANSI_1 = 0x12
	kVK_ANSI_2 = 0x13
	kVK_ANSI_3 = 0x14
	kVK_ANSI_4 = 0x15
	kVK_ANSI_6 = 0x16
	kVK_ANSI_5 = 0x17
	kVK_ANSI_Eq = 0x18
	kVK_ANSI_9 = 0x19
	kVK_ANSI_7 = 0x1A
	kVK_ANSI_Minus = 0x1B
	kVK_ANSI_8 = 0x1C
	kVK_ANSI_0 = 0x1D
	kVK_ANSI_RightBracket = 0x1E
	kVK_ANSI_O = 0x1F
	kVK_ANSI_U = 0x20
	kVK_ANSI_LeftBracket = 0x21
	kVK_ANSI_I = 0x22
	kVK_ANSI_P = 0x23
	kVK_ANSI_L = 0x25
	kVK_ANSI_J = 0x26
	kVK_ANSI_Quote = 0x27
	kVK_ANSI_K = 0x28
	kVK_ANSI_Semicolon = 0x29
	kVK_ANSI_Backslash = 0x2A
	kVK_ANSI_Comma = 0x2B
	kVK_ANSI_Slash = 0x2C
	kVK_ANSI_N = 0x2D
	kVK_ANSI_M = 0x2E
	kVK_ANSI_Period = 0x2F
	kVK_ANSI_Grave = 0x32
	kVK_ANSI_KeypadDecimal = 0x41
	kVK_ANSI_KeypadMultiply = 0x43
	kVK_ANSI_KeypadPlus = 0x45
	kVK_ANSI_KeypadClear = 0x47
	kVK_ANSI_KeypadDivide = 0x4B
	kVK_ANSI_KeypadEnter = 0x4C
	kVK_ANSI_KeypadMinus = 0x4E
	kVK_ANSI_KeypadEquals = 0x51
	kVK_ANSI_Keypad0 = 0x52
	kVK_ANSI_Keypad1 = 0x53
	kVK_ANSI_Keypad2 = 0x54
	kVK_ANSI_Keypad3 = 0x55
	kVK_ANSI_Keypad4 = 0x56
	kVK_ANSI_Keypad5 = 0x57
	kVK_ANSI_Keypad6 = 0x58
	kVK_ANSI_Keypad7 = 0x59
	kVK_ANSI_Keypad8 = 0x5B
	kVK_ANSI_Keypad9 = 0x5C
	kVK_Return = 0x24
	kVK_Tab = 0x30
	kVK_Space = 0x31
	kVK_Delete = 0x33
	kVK_Escape = 0x35
	kVK_RightCommand = 0x36
	kVK_Command      = 0x37
	kVK_Shift        = 0x38
	kVK_CapsLock = 0x39
	kVK_Option = 0x3A
	kVK_Control = 0x3B
	kVK_RightShift = 0x3C
	kVK_RightOption = 0x3D
	kVK_RightControl = 0x3E
	kVK_Function = 0x3F
	kVK_F17 = 0x40
	kVK_VolumeUp = 0x48
	kVK_VolumeDown = 0x49
	kVK_Mute = 0x4A
	kVK_F18 = 0x4F
	kVK_F19 = 0x50
	kVK_F20 = 0x5A
	kVK_F5 = 0x60
	kVK_F6 = 0x61
	kVK_F7 = 0x62
	kVK_F3 = 0x63
	kVK_F8 = 0x64
	kVK_F9 = 0x65
	kVK_F11 = 0x67
	kVK_F13 = 0x69
	kVK_F16 = 0x6A
	kVK_F14 = 0x6B
	kVK_F10 = 0x6D
	kVK_F12 = 0x6F
	kVK_F15 = 0x71
	kVK_Help = 0x72
	kVK_Home = 0x73
	kVK_PageUp = 0x74
	kVK_ForwardDelete = 0x75
	kVK_F4 = 0x76
	kVK_End = 0x77
	kVK_F2 = 0x78
	kVK_PageDown = 0x79
	kVK_F1 = 0x7A
	kVK_LeftArrow = 0x7B
	kVK_RightArrow = 0x7C
	kVK_DownArrow = 0x7D
	kVK_UpArrow = 0x7E
)

var keyNameMap = map[string]int{
	"A": kVK_ANSI_A, "B": kVK_ANSI_B, "C": kVK_ANSI_C, "D": kVK_ANSI_D,
	"E": kVK_ANSI_E, "F": kVK_ANSI_F, "G": kVK_ANSI_G, "H": kVK_ANSI_H,
	"I": kVK_ANSI_I, "J": kVK_ANSI_J, "K": kVK_ANSI_K, "L": kVK_ANSI_L,
	"M": kVK_ANSI_M, "N": kVK_ANSI_N, "O": kVK_ANSI_O, "P": kVK_ANSI_P,
	"Q": kVK_ANSI_Q, "R": kVK_ANSI_R, "S": kVK_ANSI_S, "T": kVK_ANSI_T,
	"U": kVK_ANSI_U, "V": kVK_ANSI_V, "W": kVK_ANSI_W, "X": kVK_ANSI_X,
	"Y": kVK_ANSI_Y, "Z": kVK_ANSI_Z,
	"1": kVK_ANSI_1, "2": kVK_ANSI_2, "3": kVK_ANSI_3, "4": kVK_ANSI_4,
	"5": kVK_ANSI_5, "6": kVK_ANSI_6, "7": kVK_ANSI_7, "8": kVK_ANSI_8,
	"9": kVK_ANSI_9, "0": kVK_ANSI_0,
	// Punctuation and symbols
	"Equal": kVK_ANSI_Eq, "=": kVK_ANSI_Eq,
	"Minus": kVK_ANSI_Minus, "-": kVK_ANSI_Minus,
	"LeftBracket": kVK_ANSI_LeftBracket, "[": kVK_ANSI_LeftBracket,
	"RightBracket": kVK_ANSI_RightBracket, "]": kVK_ANSI_RightBracket,
	"Quote": kVK_ANSI_Quote, "'": kVK_ANSI_Quote,
	"Semicolon": kVK_ANSI_Semicolon, ";": kVK_ANSI_Semicolon,
	"Backslash": kVK_ANSI_Backslash, "\\": kVK_ANSI_Backslash,
	"Comma": kVK_ANSI_Comma, ",": kVK_ANSI_Comma,
	"Slash": kVK_ANSI_Slash, "/": kVK_ANSI_Slash,
	"Period": kVK_ANSI_Period, ".": kVK_ANSI_Period,
	"Grave": kVK_ANSI_Grave, "`": kVK_ANSI_Grave,
	// Navigation and editing
	"Space": kVK_Space, "Enter": kVK_Return, "Return": kVK_Return,
	"Tab": kVK_Tab, "Esc": kVK_Escape, "Escape": kVK_Escape,
	"Delete": kVK_Delete, "Backspace": kVK_Delete,
	"ForwardDelete": kVK_ForwardDelete,
	"Home": kVK_Home, "End": kVK_End,
	"PageUp": kVK_PageUp, "PageDown": kVK_PageDown,
	"Left": kVK_LeftArrow, "Right": kVK_RightArrow, "Up": kVK_UpArrow, "Down": kVK_DownArrow,
	// Function keys
	"F1": kVK_F1, "F2": kVK_F2, "F3": kVK_F3, "F4": kVK_F4, "F5": kVK_F5,
	"F6": kVK_F6, "F7": kVK_F7, "F8": kVK_F8, "F9": kVK_F9, "F10": kVK_F10,
	"F11": kVK_F11, "F12": kVK_F12, "F13": kVK_F13, "F14": kVK_F14, "F15": kVK_F15,
	"F16": kVK_F16, "F17": kVK_F17, "F18": kVK_F18, "F19": kVK_F19, "F20": kVK_F20,
	// Modifier keys (for modifier-only hotkeys like Ctrl+Shift)
	"Shift": kVK_Shift, "RightShift": kVK_RightShift,
	"Control": kVK_Control, "Ctrl": kVK_Control, "RightControl": kVK_RightControl,
	"Option": kVK_Option, "Alt": kVK_Option, "RightOption": kVK_RightOption,
	"Command": kVK_Command, "Cmd": kVK_Command, "RightCommand": kVK_RightCommand,
	"CapsLock": kVK_CapsLock, "Function": kVK_Function, "Fn": kVK_Function,
}
