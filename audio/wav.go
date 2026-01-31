package audio

import (
	"encoding/binary"
	"fmt"
	"io"
	"os"
)

// WriteWAV writes audio samples to a WAV file
// samples: float32 audio samples (assumed -1.0 to 1.0 range)
// sampleRate: e.g. 16000
func WriteWAV(filename string, samples []float32, sampleRate int) error {
	file, err := os.Create(filename)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()

	// Convert samples to int16
	int16Samples := make([]int16, len(samples))
	for i, s := range samples {
		// Clamp to -1.0 to 1.0
		if s > 1.0 {
			s = 1.0
		} else if s < -1.0 {
			s = -1.0
		}
		// Scale to int16 range
		int16Samples[i] = int16(s * 32767)
	}

	// WAV Header parameters
	numChannels := 1
	bitsPerSample := 16
	byteRate := sampleRate * numChannels * (bitsPerSample / 8)
	blockAlign := numChannels * (bitsPerSample / 8)
	subChunk2Size := len(int16Samples) * numChannels * (bitsPerSample / 8)
	chunkSize := 36 + subChunk2Size

	// Write RIFF Header
	if _, err := file.WriteString("RIFF"); err != nil {
		return err
	}
	if err := binary.Write(file, binary.LittleEndian, int32(chunkSize)); err != nil {
		return err
	}
	if _, err := file.WriteString("WAVE"); err != nil {
		return err
	}

	// Write fmt chunk
	if _, err := file.WriteString("fmt "); err != nil {
		return err
	}
	if err := binary.Write(file, binary.LittleEndian, int32(16)); err != nil { // SubChunk1Size (16 for PCM)
		return err
	}
	if err := binary.Write(file, binary.LittleEndian, int16(1)); err != nil { // AudioFormat (1 for PCM)
		return err
	}
	if err := binary.Write(file, binary.LittleEndian, int16(numChannels)); err != nil {
		return err
	}
	if err := binary.Write(file, binary.LittleEndian, int32(sampleRate)); err != nil {
		return err
	}
	if err := binary.Write(file, binary.LittleEndian, int32(byteRate)); err != nil {
		return err
	}
	if err := binary.Write(file, binary.LittleEndian, int16(blockAlign)); err != nil {
		return err
	}
	if err := binary.Write(file, binary.LittleEndian, int16(bitsPerSample)); err != nil {
		return err
	}

	// Write data chunk
	if _, err := file.WriteString("data"); err != nil {
		return err
	}
	if err := binary.Write(file, binary.LittleEndian, int32(subChunk2Size)); err != nil {
		return err
	}

	// Write samples
	if err := binary.Write(file, binary.LittleEndian, int16Samples); err != nil {
		return err
	}

	return nil
}

// WAVWriter handles incremental writing of WAV files
type WAVWriter struct {
	file        *os.File
	sampleRate  int
	numChannels int
	dataSize    uint32
}

// NewWAVWriter creates a new WAV writer
func NewWAVWriter(filename string, sampleRate int) (*WAVWriter, error) {
	file, err := os.Create(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to create file: %w", err)
	}

	// Write placeholder header
	if err := writeWAVHeader(file, sampleRate, 0); err != nil {
		file.Close()
		return nil, fmt.Errorf("failed to write header: %w", err)
	}

	return &WAVWriter{
		file:        file,
		sampleRate:  sampleRate,
		numChannels: 1,
		dataSize:    0,
	}, nil
}

// WriteSamples writes float32 samples to the WAV file
func (w *WAVWriter) WriteSamples(samples []float32) error {
	int16Samples := make([]int16, len(samples))
	for i, s := range samples {
		// Clamp to -1.0 to 1.0
		if s > 1.0 {
			s = 1.0
		} else if s < -1.0 {
			s = -1.0
		}
		// Scale to int16 range
		int16Samples[i] = int16(s * 32767)
	}

	if err := binary.Write(w.file, binary.LittleEndian, int16Samples); err != nil {
		return err
	}

	w.dataSize += uint32(len(int16Samples) * 2) // 2 bytes per sample (16-bit)
	return nil
}

// Close updates the header and closes the file
func (w *WAVWriter) Close() error {
	// Update header with correct size
	if _, err := w.file.Seek(0, 0); err != nil {
		w.file.Close()
		return fmt.Errorf("failed to seek to beginning of file: %w", err)
	}

	if err := writeWAVHeader(w.file, w.sampleRate, w.dataSize); err != nil {
		w.file.Close()
		return fmt.Errorf("failed to update header: %w", err)
	}

	return w.file.Close()
}

// writeWAVHeader writes the WAV header
func writeWAVHeader(w io.Writer, sampleRate int, dataSize uint32) error {
	numChannels := 1
	bitsPerSample := 16
	byteRate := sampleRate * numChannels * (bitsPerSample / 8)
	blockAlign := numChannels * (bitsPerSample / 8)
	chunkSize := 36 + dataSize

	// Write RIFF Header
	if _, err := io.WriteString(w, "RIFF"); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, int32(chunkSize)); err != nil {
		return err
	}
	if _, err := io.WriteString(w, "WAVE"); err != nil {
		return err
	}

	// Write fmt chunk
	if _, err := io.WriteString(w, "fmt "); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, int32(16)); err != nil { // SubChunk1Size (16 for PCM)
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, int16(1)); err != nil { // AudioFormat (1 for PCM)
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, int16(numChannels)); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, int32(sampleRate)); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, int32(byteRate)); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, int16(blockAlign)); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, int16(bitsPerSample)); err != nil {
		return err
	}

	// Write data chunk
	if _, err := io.WriteString(w, "data"); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, int32(dataSize)); err != nil {
		return err
	}

	return nil
}

// ReadWAV reads a WAV file into float32 samples
func ReadWAV(filename string) ([]float32, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	// Read RIFF header
	header := make([]byte, 12)
	if _, err := io.ReadFull(file, header); err != nil {
		return nil, fmt.Errorf("failed to read RIFF header: %w", err)
	}

	if string(header[0:4]) != "RIFF" || string(header[8:12]) != "WAVE" {
		return nil, fmt.Errorf("invalid WAV file")
	}

	// Iterate through chunks to find "data"
	for {
		chunkHeader := make([]byte, 8)
		if _, err := io.ReadFull(file, chunkHeader); err != nil {
			if err == io.EOF {
				return nil, fmt.Errorf("data chunk not found")
			}
			return nil, fmt.Errorf("failed to read chunk header: %w", err)
		}

		chunkID := string(chunkHeader[0:4])
		chunkSize := binary.LittleEndian.Uint32(chunkHeader[4:8])

		if chunkID == "data" {
			// Found data chunk
			numSamples := int(chunkSize) / 2
			samples := make([]float32, numSamples)

			buf := make([]byte, chunkSize)
			if _, err := io.ReadFull(file, buf); err != nil {
				return nil, fmt.Errorf("failed to read data chunk: %w", err)
			}

			// Convert int16 to float32
			for i := 0; i < numSamples; i++ {
				idx := i * 2
				val := int16(uint16(buf[idx]) | uint16(buf[idx+1])<<8)
				samples[i] = float32(val) / 32768.0
			}

			return samples, nil
		} else {
			// Skip chunk
			if _, err := file.Seek(int64(chunkSize), io.SeekCurrent); err != nil {
				return nil, fmt.Errorf("failed to seek to beginning of next chunk: %w", err)
			}
		}
	}
}

// GetWAVDuration returns duration of WAV file in seconds
func GetWAVDuration(filename string) (float64, error) {
    file, err := os.Open(filename)
    if err != nil {
        return 0, err
    }
    defer file.Close()

    header := make([]byte, 44)
    if _, err := io.ReadFull(file, header); err != nil {
        return 0, err
    }
    
    // Parse SampleRate (bytes 24-28)
    sampleRate := binary.LittleEndian.Uint32(header[24:28])
    // Parse ByteRate (bytes 28-32)
    byteRate := binary.LittleEndian.Uint32(header[28:32])
    // Parse DataSize (bytes 40-44)
    dataSize := binary.LittleEndian.Uint32(header[40:44])

    if byteRate == 0 || sampleRate == 0 {
         return 0, fmt.Errorf("invalid WAV header")
    }

    duration := float64(dataSize) / float64(byteRate)
    return duration, nil
}
