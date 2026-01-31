//go:build !darwin

package hotkey

import "fmt"

func startTap(hotkeyStr string, handsFreeHotkeyStr string, onPress, onRelease, onHandsFreeToggle func()) error {
	return fmt.Errorf("event tap not supported on this platform")
}

func stopTap() {
}
