package audio

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"unsafe"

	"github.com/gen2brain/malgo"
)

// AudioLevelCallback is called with the current audio level (0.0 - 1.0)
type AudioLevelCallback func(level float32)

// StreamCallback is called with audio samples in real-time for streaming processing
type StreamCallback func(samples []float32)

// AudioService handles audio capture from microphone
type AudioService struct {
	ctx          context.Context
	cancel       context.CancelFunc
	device       *malgo.Device
	malgoCtx     *malgo.AllocatedContext // Keep context alive
	sampleRate   uint32
	buffer       []float32
	mutex        sync.RWMutex
	isRunning    bool
	// Audio processing components

	// Audio level monitoring for visualization
	onAudioLevel        AudioLevelCallback
	levelSampleCounter  int
	levelUpdateInterval int // Update level every N samples

	// Recording components
	recordingMutex sync.Mutex
	isRecording    bool
	wavWriter      *WAVWriter
	recordingChan  chan []float32
	recordingDone  chan struct{}
	
	// Level processing
	levelChan      chan float32
	levelDone      chan struct{}
	
	// Streaming mode for real-time processing (e.g., VAD)
	streamCallback StreamCallback
	streamMutex    sync.RWMutex
}

// NewAudioService creates a new audio service for capturing microphone input
func NewAudioService() *AudioService {
	sampleRate := uint32(16000) // Whisper requires 16kHz
	
	return &AudioService{
		sampleRate:          sampleRate,
		buffer:              make([]float32, 0, 16000*5), // 5 second buffer capacity
		isRunning:           false,
		// Initialize audio processing pipeline

		// Audio level updates ~30fps (every 533 samples at 16kHz)
		levelUpdateInterval: 533,
		levelSampleCounter:  0,
		levelChan:           make(chan float32, 10), // Small buffer for levels
	}
}

// StartRecording starts recording audio to a file
func (a *AudioService) StartRecording(filename string) error {
	a.recordingMutex.Lock()
	defer a.recordingMutex.Unlock()

	if a.isRecording {
		return fmt.Errorf("already recording")
	}

	writer, err := NewWAVWriter(filename, int(a.sampleRate))
	if err != nil {
		return fmt.Errorf("failed to create WAV writer: %w", err)
	}

	a.wavWriter = writer
	a.recordingChan = make(chan []float32, 100) // Buffer for ~10s of audio if chunks are 100ms
	a.recordingDone = make(chan struct{})
	a.isRecording = true

	// Start background writer
	go a.recordingLoop()

	slog.Info("Started recording", "filename", filename)
	return nil
}

// StopRecording stops recording audio
func (a *AudioService) StopRecording() error {
	a.recordingMutex.Lock()
	if !a.isRecording {
		a.recordingMutex.Unlock()
		return nil
	}
	
	// Signal writer to stop
	close(a.recordingChan)
	a.isRecording = false
	a.recordingMutex.Unlock()

	// Wait for writer to finish closing the file
	<-a.recordingDone
	
	slog.Info("Recording stopped")
	return nil
}

// recordingLoop handles writing audio samples to disk in the background
func (a *AudioService) recordingLoop() {
	defer close(a.recordingDone)
	defer func() {
		if a.wavWriter != nil {
			a.wavWriter.Close()
			a.wavWriter = nil
		}
	}()

	for samples := range a.recordingChan {
		if a.wavWriter != nil {
			if err := a.wavWriter.WriteSamples(samples); err != nil {
				slog.Error("Error writing audio samples", "error", err)
				return // Stop writing on error
			}
		}
	}
}

// SetAudioLevelCallback sets the callback for audio level updates (for waveform visualization)
func (a *AudioService) SetAudioLevelCallback(callback AudioLevelCallback) {
	a.mutex.Lock()
	defer a.mutex.Unlock()
	a.onAudioLevel = callback
}

// SetStreamCallback sets the callback for real-time audio streaming (e.g., for VAD processing)
// The callback receives audio samples as they arrive from the microphone
func (a *AudioService) SetStreamCallback(callback StreamCallback) {
	a.streamMutex.Lock()
	defer a.streamMutex.Unlock()
	a.streamCallback = callback
}

// ClearStreamCallback removes the stream callback
func (a *AudioService) ClearStreamCallback() {
	a.streamMutex.Lock()
	defer a.streamMutex.Unlock()
	a.streamCallback = nil
}

// Start begins audio capture from the default microphone
func (a *AudioService) Start() error {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	if a.isRunning {
		return fmt.Errorf("audio service is already running")
	}

	// Initialize context for this session
	a.ctx, a.cancel = context.WithCancel(context.Background())

	slog.Info("Initializing malgo audio context")

	// Initialize malgo context
	ctx, err := malgo.InitContext(nil, malgo.ContextConfig{}, func(message string) {
		slog.Debug("malgo message", "message", message)
	})
	if err != nil {
		return fmt.Errorf("failed to initialize audio context: %w", err)
	}

	slog.Info("Configuring audio device for capture")

	// Configure device for capture
	deviceConfig := malgo.DefaultDeviceConfig(malgo.Capture)
	deviceConfig.Capture.Format = malgo.FormatF32
	deviceConfig.Capture.Channels = 1
	deviceConfig.SampleRate = a.sampleRate
	deviceConfig.Alsa.NoMMap = 1

	slog.Info("Audio config", "format", "F32", "channels", 1, "samplerate", a.sampleRate)

	// Create capture device
	slog.Info("Creating capture device")
	device, err := malgo.InitDevice(ctx.Context, deviceConfig, malgo.DeviceCallbacks{
		Data: a.audioDataCallback,
	})
	if err != nil {
		ctx.Uninit()
		return fmt.Errorf("failed to initialize capture device: %w", err)
	}

	// Start the device
	slog.Info("Starting audio capture device")
	err = device.Start()
	if err != nil {
		device.Uninit()
		ctx.Uninit()
		return fmt.Errorf("failed to start capture device: %w", err)
	}

	a.device = device
	a.malgoCtx = ctx
	a.isRunning = true
	
	// Start level processing loop
	a.levelDone = make(chan struct{})
	go a.levelLoop()

	slog.Info("Audio capture started successfully")
	return nil
}

// levelLoop handles the emission of audio level events on a dedicated goroutine
func (a *AudioService) levelLoop() {
	defer close(a.levelDone)
	slog.Info("levelLoop started")
	for {
		select {
		case level, ok := <-a.levelChan:
			if !ok {
				slog.Info("levelChan closed, exiting levelLoop")
				return
			}
			// Call callback from this dedicated goroutine
			// No need to spawn per-sample
			if a.onAudioLevel != nil {
				a.onAudioLevel(level)
			}
		case <-a.ctx.Done():
			slog.Info("Context done, exiting levelLoop")
			return
		}
	}
}

// Stop ends audio capture
func (a *AudioService) Stop() error {
	// First stop recording if active
	// Use separate goroutine to avoid potential deadlocks if called from within callbacks
	// though Stop shouldn't be called from callbacks.
	if err := a.StopRecording(); err != nil {
		slog.Error("Error stopping recording", "error", err)
	}

	a.mutex.Lock()

	if !a.isRunning {
		a.mutex.Unlock()
		return nil
	}

	a.cancel()
	a.cancel()
	a.isRunning = false
	
	// Wait for level loop to finish
	if a.levelDone != nil {
		// Close level chan? Or wait for context done?
		// Context is cancelled above, loop should exit.
		// drain or just wait?
		<-a.levelDone
		a.levelDone = nil
	}

	device := a.device
	a.device = nil
	a.mutex.Unlock()

	if device != nil {
		device.Stop()
		device.Uninit()
	}

	if a.malgoCtx != nil {
		a.malgoCtx.Uninit()
		a.malgoCtx.Free()
		a.malgoCtx = nil
	}

	// Clear buffer and reset audio processors
	a.mutex.Lock()
	a.buffer = a.buffer[:0]
	// Reset filter states for clean start next time

	a.mutex.Unlock()

	slog.Info("Audio capture stopped")
	return nil
}

// GetSamples returns a copy of the current audio buffer and clears it
func (a *AudioService) GetSamples() []float32 {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	bufferLen := len(a.buffer)
	if bufferLen == 0 {
		return nil
	}

	// Count non-zero samples
	nonZeroCount := 0
	for _, sample := range a.buffer {
		if sample != 0.0 {
			nonZeroCount++
		}
	}

	// fmt.Printf("GetSamples: returning %d samples (%d non-zero)\n", bufferLen, nonZeroCount)

	// Copy buffer contents
	samples := make([]float32, bufferLen)
	copy(samples, a.buffer)

	// Clear buffer for next batch
	a.buffer = a.buffer[:0]

	return samples
}

// IsRunning returns whether the audio service is currently capturing
func (a *AudioService) IsRunning() bool {
	a.mutex.RLock()
	defer a.mutex.RUnlock()
	return a.isRunning
}

// audioDataCallback is called by malgo when new audio data is available
func (a *AudioService) audioDataCallback(outputSample, inputSamples []byte, framecount uint32) {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	if !a.isRunning {
		return
	}

	// Debug: Check if we received any data
	if len(inputSamples) == 0 {
		// fmt.Println("WARNING: Received empty audio data")
		return
	}

	if framecount == 0 {
		// fmt.Println("WARNING: Received zero frame count")
		return
	}

	// Convert byte slice to float32 samples
	samples := make([]float32, framecount)
	sampleCount := 0
	maxAmplitude := float32(0.0)

	// AUDIO PROCESSING PIPELINE:
	// 1. Convert bytes to float32
	// 2. Apply high-pass filter (removes low-frequency rumble < 80Hz)
	// 3. Apply noise gate (reduces background noise)
	// 4. Apply loudness normalization (consistent audio levels)
	// 5. Apply soft clipping (prevents harsh distortion)
	
	for i := uint32(0); i < framecount; i++ {
		offset := i * 4
		if offset+4 <= uint32(len(inputSamples)) {
			// Read float32 from bytes (little-endian)
			bits := uint32(inputSamples[offset]) |
					uint32(inputSamples[offset+1])<<8 |
					uint32(inputSamples[offset+2])<<16 |
					uint32(inputSamples[offset+3])<<24
			sample := *(*float32)(unsafe.Pointer(&bits))

			// Step 1: No high-pass filter - raw audio capture
			// sample = a.highPassFilter.Process(sample)
			
			// Step 2: No soft clipping - raw audio capture
			// sample = softClip(sample)

			samples[i] = sample

			// Track statistics
			if sample != 0.0 {
				sampleCount++
			}
			absSample := sample
			if absSample < 0 {
				absSample = -absSample
			}
			if absSample > maxAmplitude {
				maxAmplitude = absSample
			}
		}
	}

	// Debug: Log audio data statistics (only occasionally to avoid spam)
	// if len(a.buffer) == 0 { // Only log the first time we get data
	// 	fmt.Printf("Audio callback: framecount=%d, inputSamples=%d bytes, non-zero samples=%d/%d, max amplitude=%.6f\n",
	// 		framecount, len(inputSamples), sampleCount, len(samples), maxAmplitude)
	// }

	// Emit audio level for waveform visualization
	a.levelSampleCounter += int(framecount)
	if a.onAudioLevel != nil && a.levelSampleCounter >= a.levelUpdateInterval {
		// Normalize maxAmplitude to 0-1 range with some headroom
		normalizedLevel := maxAmplitude * 2.0 // Boost for visibility
		if normalizedLevel > 1.0 {
			normalizedLevel = 1.0
		}
		// Non-blocking send to level channel
		select {
		case a.levelChan <- normalizedLevel:
		default:
			// Drop level update if buffer full (UI too slow)
		}
		a.levelSampleCounter = 0
	}

	// Append to capture buffer
	a.buffer = append(a.buffer, samples...)
	
	// Call stream callback for real-time processing (e.g., VAD)
	// Use RLock to check without blocking other readers
	a.streamMutex.RLock()
	streamCb := a.streamCallback
	a.streamMutex.RUnlock()
	if streamCb != nil {
		// Copy samples for callback to avoid race conditions
		samplesCopy := make([]float32, len(samples))
		copy(samplesCopy, samples)
		// Call synchronously - callback must be fast to avoid audio issues
		streamCb(samplesCopy)
	}

	// Send to recorder if active
	// We need to release the main mutex briefly to acquire recording mutex?
	// OR we just use a channel which is thread safe.
	// We check atomic flag or just push if channel is not nil? 
	// To be safe, we guard with recordingMutex
	
	// IMPORTANT: Don't block audio callback!
	// Send to recorder if active
	// Use TryLock to avoid blocking the audio callback and avoid spawning goroutines
	if a.recordingMutex.TryLock() {
		if a.isRecording && a.recordingChan != nil {
			// Try to send to channel without blocking
			select {
			case a.recordingChan <- samples:
				// sent
			default:
				// buffer full, drop to avoid blocking
				// fmt.Println("Warning: recording buffer full, dropping audio chunk")
			}
		}
		a.recordingMutex.Unlock()
	} else {
		// Failed to acquire lock immediately, drop chunk to maintain audio performance
	}
}

// GetSampleRate returns the sample rate being used
func (a *AudioService) GetSampleRate() uint32 {
	return a.sampleRate
}
