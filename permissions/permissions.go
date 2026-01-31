package permissions

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa -framework AVFoundation -framework ApplicationServices

#import <Cocoa/Cocoa.h>
#import <AVFoundation/AVFoundation.h>
#import <ApplicationServices/ApplicationServices.h>

// Check if the application has accessibility permissions
int checkAccessibilityPermission() {
    // AXIsProcessTrusted returns true if the app has accessibility permissions
    return AXIsProcessTrusted() ? 1 : 0;
}

// Open System Preferences to Accessibility pane
void openAccessibilitySettings() {
    NSURL *url = [NSURL URLWithString:@"x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"];
    [[NSWorkspace sharedWorkspace] openURL:url];
}

// Check microphone permission status
// Returns: 0 = not determined, 1 = denied, 2 = authorized, 3 = restricted
int checkMicrophonePermission() {
    AVAuthorizationStatus status = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeAudio];
    switch (status) {
        case AVAuthorizationStatusNotDetermined:
            return 0;
        case AVAuthorizationStatusDenied:
            return 1;
        case AVAuthorizationStatusAuthorized:
            return 2;
        case AVAuthorizationStatusRestricted:
            return 3;
        default:
            return 0;
    }
}

// Request microphone permission - this will trigger the system dialog
void requestMicrophonePermission() {
    [AVCaptureDevice requestAccessForMediaType:AVMediaTypeAudio completionHandler:^(BOOL granted) {
        // Callback is handled asynchronously, we don't need to do anything here
        // The frontend will poll for status changes
    }];
}

// Open System Preferences to Microphone pane
void openMicrophoneSettings() {
    NSURL *url = [NSURL URLWithString:@"x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"];
    [[NSWorkspace sharedWorkspace] openURL:url];
}
*/
import "C"

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// PermissionStatus represents the state of a permission
type PermissionStatus string

const (
	StatusUnknown   PermissionStatus = "unknown"
	StatusGranted   PermissionStatus = "granted"
	StatusDenied    PermissionStatus = "denied"
	StatusNotAsked  PermissionStatus = "not_asked"
	StatusRestricted PermissionStatus = "restricted"
)

// PermissionsState holds the current state of all required permissions
type PermissionsState struct {
	Accessibility PermissionStatus `json:"accessibility"`
	Microphone    PermissionStatus `json:"microphone"`
}

// OnboardingConfig stores the onboarding completion state
type OnboardingConfig struct {
	OnboardingComplete bool `json:"onboarding_complete"`
}

// PermissionsService manages permission checking and onboarding state
type PermissionsService struct {
	configPath string
	mu         sync.Mutex
}

// NewPermissionsService creates a new permissions service
func NewPermissionsService() (*PermissionsService, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}

	configDir := filepath.Join(homeDir, ".supercharacters")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create config directory: %w", err)
	}

	return &PermissionsService{
		configPath: filepath.Join(configDir, "config.json"),
	}, nil
}

// CheckAccessibility checks if accessibility permission is granted
func (s *PermissionsService) CheckAccessibility() PermissionStatus {
	result := C.checkAccessibilityPermission()
	if result == 1 {
		return StatusGranted
	}
	return StatusDenied
}

// CheckMicrophone checks the microphone permission status
func (s *PermissionsService) CheckMicrophone() PermissionStatus {
	result := C.checkMicrophonePermission()
	switch result {
	case 0:
		return StatusNotAsked
	case 1:
		return StatusDenied
	case 2:
		return StatusGranted
	case 3:
		return StatusRestricted
	default:
		return StatusUnknown
	}
}

// GetPermissionsState returns the current state of all permissions
func (s *PermissionsService) GetPermissionsState() PermissionsState {
	return PermissionsState{
		Accessibility: s.CheckAccessibility(),
		Microphone:    s.CheckMicrophone(),
	}
}

// OpenAccessibilitySettings opens System Preferences to the Accessibility pane
func (s *PermissionsService) OpenAccessibilitySettings() {
	C.openAccessibilitySettings()
}

// RequestMicrophonePermission triggers the system microphone permission dialog
func (s *PermissionsService) RequestMicrophonePermission() {
	C.requestMicrophonePermission()
}

// OpenMicrophoneSettings opens System Preferences to the Microphone pane
func (s *PermissionsService) OpenMicrophoneSettings() {
	C.openMicrophoneSettings()
}

// IsOnboardingComplete checks if the user has completed onboarding
func (s *PermissionsService) IsOnboardingComplete() bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.configPath)
	if err != nil {
		// File doesn't exist or can't be read - onboarding not complete
		return false
	}

	var config OnboardingConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return false
	}

	return config.OnboardingComplete
}

// CompleteOnboarding marks the onboarding as complete
func (s *PermissionsService) CompleteOnboarding() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	config := OnboardingConfig{
		OnboardingComplete: true,
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(s.configPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	return nil
}

// ResetOnboarding resets the onboarding state (for testing)
func (s *PermissionsService) ResetOnboarding() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	config := OnboardingConfig{
		OnboardingComplete: false,
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(s.configPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	return nil
}

// AllPermissionsGranted returns true if all required permissions are granted
func (s *PermissionsService) AllPermissionsGranted() bool {
	state := s.GetPermissionsState()
	return state.Accessibility == StatusGranted && state.Microphone == StatusGranted
}
