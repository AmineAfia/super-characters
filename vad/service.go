package vad

import (
	"log/slog"
	"math"
	"sync"
	"time"
)

// SpeechStartCallback is called when speech is detected
type SpeechStartCallback func()

// SpeechEndCallback is called when speech ends, with the accumulated audio samples
type SpeechEndCallback func(samples []float32)

// VADService provides real-time voice activity detection
type VADService struct {
	// Configuration
	energyThreshold     float32       // RMS energy threshold to detect speech (0.0 - 1.0)
	silenceDuration     time.Duration // Duration of silence to trigger speech end
	minSpeechDuration   time.Duration // Minimum speech duration before accepting
	maxSpeechDuration   time.Duration // Maximum speech duration (buffer limit)

	// State
	isSpeaking          bool
	silenceStartTime    time.Time
	speechStartTime     time.Time
	speechBuffer        []float32
	recentEnergy        []float32  // Rolling window of energy values for smoothing
	energyWindowSize    int

	// Callbacks
	onSpeechStart       SpeechStartCallback
	onSpeechEnd         SpeechEndCallback

	// Synchronization
	mutex               sync.Mutex
	enabled             bool
	paused              bool // Pause VAD during TTS playback
	
	// Sample rate for duration calculations
	sampleRate          uint32
}

// Config holds VAD configuration
type Config struct {
	EnergyThreshold   float32       // RMS energy threshold (default: 0.015)
	SilenceDuration   time.Duration // Silence to trigger end (default: 300ms)
	MinSpeechDuration time.Duration // Minimum speech duration (default: 200ms)
	MaxSpeechDuration time.Duration // Maximum speech duration (default: 30s)
	SampleRate        uint32        // Audio sample rate (default: 16000)
}

// DefaultConfig returns default VAD configuration
func DefaultConfig() Config {
	return Config{
		EnergyThreshold:   0.015,              // Tuned for typical speech
		SilenceDuration:   300 * time.Millisecond,
		MinSpeechDuration: 200 * time.Millisecond,
		MaxSpeechDuration: 30 * time.Second,
		SampleRate:        16000,
	}
}

// NewVADService creates a new VAD service with the given configuration
func NewVADService(cfg Config) *VADService {
	if cfg.SampleRate == 0 {
		cfg.SampleRate = 16000
	}
	if cfg.EnergyThreshold == 0 {
		cfg.EnergyThreshold = 0.015
	}
	if cfg.SilenceDuration == 0 {
		cfg.SilenceDuration = 300 * time.Millisecond
	}
	if cfg.MinSpeechDuration == 0 {
		cfg.MinSpeechDuration = 200 * time.Millisecond
	}
	if cfg.MaxSpeechDuration == 0 {
		cfg.MaxSpeechDuration = 30 * time.Second
	}

	return &VADService{
		energyThreshold:   cfg.EnergyThreshold,
		silenceDuration:   cfg.SilenceDuration,
		minSpeechDuration: cfg.MinSpeechDuration,
		maxSpeechDuration: cfg.MaxSpeechDuration,
		sampleRate:        cfg.SampleRate,
		speechBuffer:      make([]float32, 0, int(cfg.SampleRate)*5), // Pre-allocate 5 seconds
		recentEnergy:      make([]float32, 0, 10),                    // Rolling window of 10 chunks
		energyWindowSize:  10,
		enabled:           false,
		paused:            false,
	}
}

// SetCallbacks sets the speech detection callbacks
func (v *VADService) SetCallbacks(onStart SpeechStartCallback, onEnd SpeechEndCallback) {
	v.mutex.Lock()
	defer v.mutex.Unlock()
	v.onSpeechStart = onStart
	v.onSpeechEnd = onEnd
}

// Start enables VAD processing
func (v *VADService) Start() {
	v.mutex.Lock()
	defer v.mutex.Unlock()
	v.enabled = true
	v.paused = false
	v.reset()
	slog.Info("[VAD] Started")
}

// Stop disables VAD processing and resets state
func (v *VADService) Stop() {
	v.mutex.Lock()
	defer v.mutex.Unlock()
	v.enabled = false
	v.reset()
	slog.Info("[VAD] Stopped")
}

// Pause temporarily pauses VAD (e.g., during TTS playback)
func (v *VADService) Pause() {
	v.mutex.Lock()
	defer v.mutex.Unlock()
	v.paused = true
	slog.Debug("[VAD] Paused")
}

// Resume resumes VAD after being paused
func (v *VADService) Resume() {
	v.mutex.Lock()
	defer v.mutex.Unlock()
	v.paused = false
	// Reset state to avoid triggering on residual audio
	v.reset()
	slog.Debug("[VAD] Resumed")
}

// IsEnabled returns whether VAD is currently active
func (v *VADService) IsEnabled() bool {
	v.mutex.Lock()
	defer v.mutex.Unlock()
	return v.enabled && !v.paused
}

// IsSpeaking returns whether speech is currently detected
func (v *VADService) IsSpeaking() bool {
	v.mutex.Lock()
	defer v.mutex.Unlock()
	return v.isSpeaking
}

// SetSilenceDuration updates the silence duration threshold
func (v *VADService) SetSilenceDuration(d time.Duration) {
	v.mutex.Lock()
	defer v.mutex.Unlock()
	v.silenceDuration = d
	slog.Info("[VAD] Silence duration updated", "duration", d)
}

// SetEnergyThreshold updates the energy threshold
func (v *VADService) SetEnergyThreshold(threshold float32) {
	v.mutex.Lock()
	defer v.mutex.Unlock()
	v.energyThreshold = threshold
	slog.Info("[VAD] Energy threshold updated", "threshold", threshold)
}

// reset clears internal state
func (v *VADService) reset() {
	v.isSpeaking = false
	v.speechBuffer = v.speechBuffer[:0]
	v.recentEnergy = v.recentEnergy[:0]
	v.silenceStartTime = time.Time{}
	v.speechStartTime = time.Time{}
}

// ProcessSamples processes audio samples and detects voice activity
// This should be called from the audio callback with chunks of samples
func (v *VADService) ProcessSamples(samples []float32) {
	v.mutex.Lock()
	
	if !v.enabled || v.paused {
		v.mutex.Unlock()
		return
	}

	// Calculate RMS energy of this chunk
	energy := v.calculateRMS(samples)
	
	// Add to rolling window for smoothing
	v.recentEnergy = append(v.recentEnergy, energy)
	if len(v.recentEnergy) > v.energyWindowSize {
		v.recentEnergy = v.recentEnergy[1:]
	}
	
	// Calculate smoothed energy (average of recent values)
	smoothedEnergy := v.averageEnergy()
	
	// Determine if this is speech based on threshold
	isSpeechChunk := smoothedEnergy > v.energyThreshold

	now := time.Now()

	if isSpeechChunk {
		if !v.isSpeaking {
			// Speech started
			v.isSpeaking = true
			v.speechStartTime = now
			v.silenceStartTime = time.Time{}
			slog.Debug("[VAD] Speech started", "energy", smoothedEnergy, "threshold", v.energyThreshold)
			
			// Fire callback (unlock first to avoid deadlock)
			callback := v.onSpeechStart
			v.mutex.Unlock()
			if callback != nil {
				callback()
			}
			v.mutex.Lock()
		} else {
			// Continuing speech, reset silence timer
			v.silenceStartTime = time.Time{}
		}
		
		// Accumulate samples
		v.speechBuffer = append(v.speechBuffer, samples...)
		
		// Check max duration limit
		maxSamples := int(float64(v.sampleRate) * v.maxSpeechDuration.Seconds())
		if len(v.speechBuffer) >= maxSamples {
			slog.Warn("[VAD] Max speech duration reached, forcing end")
			v.triggerSpeechEnd()
			v.mutex.Unlock()
			return
		}
	} else {
		// Silence detected
		if v.isSpeaking {
			// Still in speech state, accumulate samples (include trailing silence)
			v.speechBuffer = append(v.speechBuffer, samples...)
			
			if v.silenceStartTime.IsZero() {
				// Start silence timer
				v.silenceStartTime = now
			} else if now.Sub(v.silenceStartTime) >= v.silenceDuration {
				// Silence duration exceeded, check if we have enough speech
				speechDuration := v.silenceStartTime.Sub(v.speechStartTime)
				if speechDuration >= v.minSpeechDuration {
					slog.Debug("[VAD] Speech ended", "duration", speechDuration, "samples", len(v.speechBuffer))
					v.triggerSpeechEnd()
					v.mutex.Unlock()
					return
				} else {
					// Speech was too short, discard
					slog.Debug("[VAD] Speech too short, discarding", "duration", speechDuration)
					v.reset()
				}
			}
		}
	}
	
	v.mutex.Unlock()
}

// triggerSpeechEnd fires the speech end callback with accumulated samples
// Must be called with mutex held
func (v *VADService) triggerSpeechEnd() {
	if len(v.speechBuffer) == 0 {
		v.reset()
		return
	}
	
	// Copy buffer for callback
	samples := make([]float32, len(v.speechBuffer))
	copy(samples, v.speechBuffer)
	
	// Get callback reference
	callback := v.onSpeechEnd
	
	// Reset state
	v.reset()
	
	// Fire callback outside of lock
	v.mutex.Unlock()
	if callback != nil {
		callback(samples)
	}
	v.mutex.Lock()
}

// calculateRMS calculates the root mean square energy of samples
func (v *VADService) calculateRMS(samples []float32) float32 {
	if len(samples) == 0 {
		return 0
	}
	
	var sum float64
	for _, s := range samples {
		sum += float64(s) * float64(s)
	}
	
	return float32(math.Sqrt(sum / float64(len(samples))))
}

// averageEnergy calculates the average of recent energy values
func (v *VADService) averageEnergy() float32 {
	if len(v.recentEnergy) == 0 {
		return 0
	}
	
	var sum float32
	for _, e := range v.recentEnergy {
		sum += e
	}
	
	return sum / float32(len(v.recentEnergy))
}

// GetBufferDuration returns the current speech buffer duration in seconds
func (v *VADService) GetBufferDuration() float64 {
	v.mutex.Lock()
	defer v.mutex.Unlock()
	return float64(len(v.speechBuffer)) / float64(v.sampleRate)
}
