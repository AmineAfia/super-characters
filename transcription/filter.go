package transcription

import (
	"regexp"
	"strings"
	"unicode"
)

// fillerWords is a list of common filler words to remove from transcription
var fillerWords = map[string]bool{
	"uh":   true,
	"um":   true,
	"uhm":  true,
	"umm":  true,
	"uhh":  true,
	"uhhh": true,
	"ah":   true,
	"eh":   true,
	"hmm":  true,
	"hm":   true,
	"mmm":  true,
	"mm":   true,
	"mh":   true,
	"ha":   true,
	"ehh":  true,
	"er":   true,
	"erm":  true,
	"like": false, // Could be filler but also valid word - disabled by default
}

// multiSpacePattern matches multiple consecutive spaces
var multiSpacePattern = regexp.MustCompile(`\s{2,}`)

// FilterConfig holds configuration for text filtering
type FilterConfig struct {
	RemoveFillerWords bool
	CollapseStutters  bool
}

// DefaultFilterConfig returns the default filter configuration
func DefaultFilterConfig() FilterConfig {
	return FilterConfig{
		RemoveFillerWords: true,
		CollapseStutters:  true,
	}
}

// FilterTranscriptionOutput removes filler words and stutters from transcription text
func FilterTranscriptionOutput(text string, config FilterConfig) string {
	if text == "" {
		return ""
	}

	result := text

	// Step 1: Collapse stutters (e.g., "wh wh wh why" -> "why")
	if config.CollapseStutters {
		result = collapseStutters(result)
	}

	// Step 2: Remove filler words
	if config.RemoveFillerWords {
		result = removeFillerWords(result)
	}

	// Step 3: Clean up whitespace
	result = cleanWhitespace(result)

	return result
}

// collapseStutters removes stuttered repetitions of short words
// "I I I I think" -> "I think"
// "wh wh wh why" -> "why"
func collapseStutters(text string) string {
	// Use a custom approach to handle stutters more accurately
	// Split into words and process
	words := strings.Fields(text)
	if len(words) < 3 {
		return text
	}

	var result []string
	i := 0

	for i < len(words) {
		word := words[i]
		wordLower := strings.ToLower(word)

		// Check if this is a short word (1-3 chars) that might be a stutter
		if len(wordLower) <= 3 {
			// Count consecutive repetitions
			count := 1
			j := i + 1
			for j < len(words) && strings.ToLower(words[j]) == wordLower {
				count++
				j++
			}

			// If we have 3 or more repetitions, it's a stutter
			if count >= 3 {
				// Check if the next word starts with this stutter (e.g., "wh wh wh why")
				if j < len(words) {
					nextWord := strings.ToLower(words[j])
					if strings.HasPrefix(nextWord, wordLower) {
						// Skip the stutters entirely, the full word follows
						i = j
						continue
					}
				}
				// Otherwise, keep just one instance
				result = append(result, word)
				i = j
				continue
			}
		}

		result = append(result, word)
		i++
	}

	return strings.Join(result, " ")
}

// removeFillerWords removes filler words from the text
func removeFillerWords(text string) string {
	words := strings.Fields(text)
	var result []string

	for _, word := range words {
		// Check if word is a filler (case-insensitive)
		wordLower := strings.ToLower(stripPunctuation(word))

		if fillerWords[wordLower] {
			// Skip filler words
			continue
		}

		result = append(result, word)
	}

	return strings.Join(result, " ")
}

// stripPunctuation removes leading and trailing punctuation from a word
func stripPunctuation(word string) string {
	runes := []rune(word)
	start := 0
	end := len(runes)

	// Find start (skip leading punctuation)
	for start < end && unicode.IsPunct(runes[start]) {
		start++
	}

	// Find end (skip trailing punctuation)
	for end > start && unicode.IsPunct(runes[end-1]) {
		end--
	}

	if start >= end {
		return ""
	}

	return string(runes[start:end])
}

// cleanWhitespace normalizes whitespace in text
func cleanWhitespace(text string) string {
	// Replace multiple spaces with single space
	result := multiSpacePattern.ReplaceAllString(text, " ")

	// Trim leading/trailing whitespace
	result = strings.TrimSpace(result)

	// Fix spacing around punctuation (no space before, one space after)
	result = fixPunctuationSpacing(result)

	return result
}

// fixPunctuationSpacing ensures proper spacing around punctuation
func fixPunctuationSpacing(text string) string {
	// Remove space before common punctuation
	text = strings.ReplaceAll(text, " .", ".")
	text = strings.ReplaceAll(text, " ,", ",")
	text = strings.ReplaceAll(text, " !", "!")
	text = strings.ReplaceAll(text, " ?", "?")
	text = strings.ReplaceAll(text, " :", ":")
	text = strings.ReplaceAll(text, " ;", ";")

	return text
}

// Custom word correction types and functions

// levenshteinDistance calculates the edit distance between two strings
func levenshteinDistance(a, b string) int {
	if len(a) == 0 {
		return len(b)
	}
	if len(b) == 0 {
		return len(a)
	}

	// Create distance matrix
	matrix := make([][]int, len(a)+1)
	for i := range matrix {
		matrix[i] = make([]int, len(b)+1)
	}

	// Initialize first row and column
	for i := 0; i <= len(a); i++ {
		matrix[i][0] = i
	}
	for j := 0; j <= len(b); j++ {
		matrix[0][j] = j
	}

	// Fill in the matrix
	for i := 1; i <= len(a); i++ {
		for j := 1; j <= len(b); j++ {
			cost := 1
			if a[i-1] == b[j-1] {
				cost = 0
			}
			matrix[i][j] = minInt(
				matrix[i-1][j]+1,      // deletion
				matrix[i][j-1]+1,      // insertion
				matrix[i-1][j-1]+cost, // substitution
			)
		}
	}

	return matrix[len(a)][len(b)]
}

func minInt(vals ...int) int {
	min := vals[0]
	for _, v := range vals[1:] {
		if v < min {
			min = v
		}
	}
	return min
}

// soundex generates a Soundex code for phonetic matching
func soundex(s string) string {
	if len(s) == 0 {
		return ""
	}

	s = strings.ToUpper(s)

	// Soundex mapping
	codes := map[rune]byte{
		'B': '1', 'F': '1', 'P': '1', 'V': '1',
		'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
		'D': '3', 'T': '3',
		'L': '4',
		'M': '5', 'N': '5',
		'R': '6',
	}

	result := make([]byte, 0, 4)
	result = append(result, s[0]) // Keep first letter

	prevCode := codes[rune(s[0])]

	for i := 1; i < len(s) && len(result) < 4; i++ {
		code, exists := codes[rune(s[i])]
		if exists && code != prevCode {
			result = append(result, code)
			prevCode = code
		} else if !exists {
			prevCode = 0 // Reset for vowels/h/w/y
		}
	}

	// Pad with zeros
	for len(result) < 4 {
		result = append(result, '0')
	}

	return string(result)
}

// ApplyCustomWords corrects words using fuzzy matching against a custom word list
// threshold is the maximum normalized Levenshtein distance (0.0 to 1.0) for a match
func ApplyCustomWords(text string, customWords []string, threshold float64) string {
	if len(customWords) == 0 || text == "" {
		return text
	}

	// Build lookup maps for custom words
	customWordMap := make(map[string]string)      // lowercase -> original case
	customSoundex := make(map[string][]string)    // soundex -> list of words

	for _, w := range customWords {
		lower := strings.ToLower(w)
		customWordMap[lower] = w
		sx := soundex(w)
		customSoundex[sx] = append(customSoundex[sx], w)
	}

	words := strings.Fields(text)
	var result []string

	for _, word := range words {
		wordLower := strings.ToLower(stripPunctuation(word))
		if wordLower == "" {
			result = append(result, word)
			continue
		}

		// Check for exact match (case-insensitive)
		if replacement, ok := customWordMap[wordLower]; ok {
			// Preserve original punctuation
			result = append(result, preservePunctuation(word, replacement))
			continue
		}

		// Try fuzzy matching
		bestMatch := ""
		bestScore := threshold + 1 // Start with invalid score

		for _, customWord := range customWords {
			customLower := strings.ToLower(customWord)

			// Calculate normalized Levenshtein distance
			dist := levenshteinDistance(wordLower, customLower)
			maxLen := max(len(wordLower), len(customLower))
			normalizedDist := float64(dist) / float64(maxLen)

			if normalizedDist < bestScore {
				bestScore = normalizedDist
				bestMatch = customWord
			}
		}

		// If we found a good fuzzy match
		if bestScore <= threshold && bestMatch != "" {
			result = append(result, preservePunctuation(word, bestMatch))
			continue
		}

		// Try phonetic matching if fuzzy didn't work
		wordSoundex := soundex(wordLower)
		if candidates, ok := customSoundex[wordSoundex]; ok && len(candidates) > 0 {
			// Use the first phonetic match
			result = append(result, preservePunctuation(word, candidates[0]))
			continue
		}

		// No match found, keep original
		result = append(result, word)
	}

	return strings.Join(result, " ")
}

// preservePunctuation applies the punctuation from original to replacement
func preservePunctuation(original, replacement string) string {
	origRunes := []rune(original)
	if len(origRunes) == 0 {
		return replacement
	}

	// Find leading punctuation
	var leadingPunct strings.Builder
	start := 0
	for start < len(origRunes) && unicode.IsPunct(origRunes[start]) {
		leadingPunct.WriteRune(origRunes[start])
		start++
	}

	// Find trailing punctuation (collect in reverse, then reverse)
	var trailingRunes []rune
	end := len(origRunes)
	for end > start && unicode.IsPunct(origRunes[end-1]) {
		trailingRunes = append(trailingRunes, origRunes[end-1])
		end--
	}
	// Reverse trailing runes
	for i, j := 0, len(trailingRunes)-1; i < j; i, j = i+1, j-1 {
		trailingRunes[i], trailingRunes[j] = trailingRunes[j], trailingRunes[i]
	}

	return leadingPunct.String() + replacement + string(trailingRunes)
}
