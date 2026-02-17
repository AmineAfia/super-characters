package characters

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// CustomCharacter represents a user-created character with its metadata.
type CustomCharacter struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Subtitle     string `json:"subtitle"`
	Voice        string `json:"voice"`
	Model        string `json:"model"`
	Description  string `json:"description"`
	Color        string `json:"color"`
	SystemPrompt string `json:"systemPrompt"`

	// File paths relative to the character's data directory
	OriginalImage string `json:"originalImage"` // Uploaded source image
	NanoBanana    string `json:"nanoBanana"`    // Generated Nano Banana styled image
	ModelGLB      string `json:"modelGlb"`      // 3D GLB model file
	Thumbnail     string `json:"thumbnail"`     // Thumbnail image for the card

	// Pipeline status
	Status    PipelineStatus `json:"status"`
	Error     string         `json:"error,omitempty"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
}

// PipelineStatus tracks the character creation pipeline progress.
type PipelineStatus string

const (
	StatusPending    PipelineStatus = "pending"     // Character created, awaiting processing
	StatusUploaded   PipelineStatus = "uploaded"     // Image uploaded
	StatusGenerating PipelineStatus = "generating"   // Nano Banana image being generated
	StatusConverting PipelineStatus = "converting"   // Converting to 3D model
	StatusReady      PipelineStatus = "ready"        // Character fully processed and ready
	StatusFailed     PipelineStatus = "failed"       // Pipeline failed
	StatusBasic      PipelineStatus = "basic"        // Basic character (no 3D pipeline, uses default avatar)
)

// Service manages custom character storage and retrieval.
type Service struct {
	dataDir    string
	characters map[string]*CustomCharacter
	mu         sync.RWMutex
}

// NewService creates a new character service with storage at ~/.super-characters/characters/
func NewService() (*Service, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}

	dataDir := filepath.Join(homeDir, ".super-characters", "characters")
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create characters directory: %w", err)
	}

	s := &Service{
		dataDir:    dataDir,
		characters: make(map[string]*CustomCharacter),
	}

	if err := s.loadAll(); err != nil {
		return nil, fmt.Errorf("failed to load characters: %w", err)
	}

	return s, nil
}

// characterDir returns the directory for a specific character's files.
func (s *Service) characterDir(id string) string {
	return filepath.Join(s.dataDir, id)
}

// loadAll reads all saved characters from disk.
func (s *Service) loadAll() error {
	indexPath := filepath.Join(s.dataDir, "index.json")
	data, err := os.ReadFile(indexPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // No characters yet
		}
		return err
	}

	var chars []*CustomCharacter
	if err := json.Unmarshal(data, &chars); err != nil {
		return fmt.Errorf("failed to parse characters index: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	for _, c := range chars {
		s.characters[c.ID] = c
	}
	return nil
}

// saveIndex writes the character index to disk.
func (s *Service) saveIndex() error {
	s.mu.RLock()
	chars := make([]*CustomCharacter, 0, len(s.characters))
	for _, c := range s.characters {
		chars = append(chars, c)
	}
	s.mu.RUnlock()

	data, err := json.MarshalIndent(chars, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal characters: %w", err)
	}

	indexPath := filepath.Join(s.dataDir, "index.json")
	return os.WriteFile(indexPath, data, 0644)
}

// Create makes a new custom character entry with the given metadata.
func (s *Service) Create(char *CustomCharacter) error {
	if char.ID == "" {
		return fmt.Errorf("character ID is required")
	}

	// Create character directory
	dir := s.characterDir(char.ID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create character directory: %w", err)
	}

	now := time.Now()
	char.CreatedAt = now
	char.UpdatedAt = now

	if char.Status == "" {
		char.Status = StatusPending
	}

	s.mu.Lock()
	s.characters[char.ID] = char
	s.mu.Unlock()

	return s.saveIndex()
}

// Get returns a character by ID.
func (s *Service) Get(id string) (*CustomCharacter, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	char, ok := s.characters[id]
	if !ok {
		return nil, fmt.Errorf("character not found: %s", id)
	}
	return char, nil
}

// List returns all custom characters.
func (s *Service) List() []*CustomCharacter {
	s.mu.RLock()
	defer s.mu.RUnlock()

	chars := make([]*CustomCharacter, 0, len(s.characters))
	for _, c := range s.characters {
		chars = append(chars, c)
	}
	return chars
}

// Update modifies an existing character's metadata.
func (s *Service) Update(char *CustomCharacter) error {
	s.mu.Lock()
	existing, ok := s.characters[char.ID]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("character not found: %s", char.ID)
	}

	char.CreatedAt = existing.CreatedAt
	char.UpdatedAt = time.Now()
	s.characters[char.ID] = char
	s.mu.Unlock()

	return s.saveIndex()
}

// Delete removes a character and its files from disk.
func (s *Service) Delete(id string) error {
	s.mu.Lock()
	_, ok := s.characters[id]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("character not found: %s", id)
	}
	delete(s.characters, id)
	s.mu.Unlock()

	// Remove character directory
	dir := s.characterDir(id)
	os.RemoveAll(dir)

	return s.saveIndex()
}

// SaveImage saves an uploaded image to the character's directory.
// Returns the relative path of the saved file.
func (s *Service) SaveImage(id string, filename string, reader io.Reader) (string, error) {
	dir := s.characterDir(id)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("failed to create character directory: %w", err)
	}

	// Use a clean filename
	ext := filepath.Ext(filename)
	savePath := filepath.Join(dir, "original"+ext)

	outFile, err := os.Create(savePath)
	if err != nil {
		return "", fmt.Errorf("failed to create file: %w", err)
	}
	defer outFile.Close()

	if _, err := io.Copy(outFile, reader); err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	// Update character record
	s.mu.Lock()
	if char, ok := s.characters[id]; ok {
		char.OriginalImage = "original" + ext
		char.Status = StatusUploaded
		char.UpdatedAt = time.Now()
	}
	s.mu.Unlock()

	return savePath, s.saveIndex()
}

// GetImagePath returns the absolute path to a character's image file.
func (s *Service) GetImagePath(id, filename string) string {
	return filepath.Join(s.characterDir(id), filename)
}

// GetModelPath returns the absolute path to a character's GLB model file.
func (s *Service) GetModelPath(id string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if char, ok := s.characters[id]; ok && char.ModelGLB != "" {
		return filepath.Join(s.characterDir(id), char.ModelGLB)
	}
	return ""
}

// SetPipelineStatus updates the pipeline status for a character.
func (s *Service) SetPipelineStatus(id string, status PipelineStatus, errMsg string) error {
	s.mu.Lock()
	char, ok := s.characters[id]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("character not found: %s", id)
	}
	char.Status = status
	char.Error = errMsg
	char.UpdatedAt = time.Now()
	s.mu.Unlock()

	return s.saveIndex()
}

// SetModelFile records the generated 3D model file for a character.
func (s *Service) SetModelFile(id, filename string) error {
	s.mu.Lock()
	char, ok := s.characters[id]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("character not found: %s", id)
	}
	char.ModelGLB = filename
	char.UpdatedAt = time.Now()
	s.mu.Unlock()

	return s.saveIndex()
}

// SetNanoBananaImage records the generated Nano Banana image for a character.
func (s *Service) SetNanoBananaImage(id, filename string) error {
	s.mu.Lock()
	char, ok := s.characters[id]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("character not found: %s", id)
	}
	char.NanoBanana = filename
	char.UpdatedAt = time.Now()
	s.mu.Unlock()

	return s.saveIndex()
}

// SetThumbnail records the thumbnail image for a character.
func (s *Service) SetThumbnail(id, filename string) error {
	s.mu.Lock()
	char, ok := s.characters[id]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("character not found: %s", id)
	}
	char.Thumbnail = filename
	char.UpdatedAt = time.Now()
	s.mu.Unlock()

	return s.saveIndex()
}

// GetDataDir returns the base data directory for all characters.
func (s *Service) GetDataDir() string {
	return s.dataDir
}
