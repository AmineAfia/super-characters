package transcription

import "strings"

// GetLanguageCode converts a language name to its ISO code
// This handles the mapping between frontend display names and Whisper's expected codes
func GetLanguageCode(name string) string {
	// Normalize input
	name = strings.TrimSpace(name)
	
	// Handle "Auto" or empty case
	if name == "" || strings.EqualFold(name, "Auto") || strings.EqualFold(name, "Auto-detect") {
		return "auto"
	}
	
	// If it's already a short code (2 chars), assume it's valid
	if len(name) == 2 {
		return strings.ToLower(name)
	}

	// Map full names to codes
	// Source: frontend/components/ui/language-selector.tsx
	switch strings.ToLower(name) {
	case "afrikaans": return "af"
	case "albanian": return "sq"
	case "amharic": return "am"
	case "arabic": return "ar"
	case "armenian": return "hy"
	case "azerbaijani": return "az"
	case "basque": return "eu"
	case "belarusian": return "be"
	case "bengali": return "bn"
	case "bosnian": return "bs"
	case "bulgarian": return "bg"
	case "catalan": return "ca"
	case "chinese", "chinese (simplified)": return "zh"
	case "chinese (traditional)": return "zh"
	case "croatian": return "hr"
	case "czech": return "cs"
	case "danish": return "da"
	case "dutch": return "nl"
	case "english": return "en"
	case "estonian": return "et"
	case "finnish": return "fi"
	case "french": return "fr"
	case "galician": return "gl"
	case "georgian": return "ka"
	case "german": return "de"
	case "greek": return "el"
	case "gujarati": return "gu"
	case "hebrew": return "he"
	case "hindi": return "hi"
	case "hungarian": return "hu"
	case "icelandic": return "is"
	case "indonesian": return "id"
	case "italian": return "it"
	case "japanese": return "ja"
	case "kannada": return "kn"
	case "kazakh": return "kk"
	case "khmer": return "km"
	case "korean": return "ko"
	case "lao": return "lo"
	case "latvian": return "lv"
	case "lithuanian": return "lt"
	case "macedonian": return "mk"
	case "malay": return "ms"
	case "malayalam": return "ml"
	case "marathi": return "mr"
	case "mongolian": return "mn"
	case "myanmar (burmese)", "burmese": return "my"
	case "nepali": return "ne"
	case "norwegian": return "no"
	case "persian": return "fa"
	case "polish": return "pl"
	case "portuguese": return "pt"
	case "punjabi": return "pa"
	case "romanian": return "ro"
	case "russian": return "ru"
	case "serbian": return "sr"
	case "sinhala": return "si"
	case "slovak": return "sk"
	case "slovenian": return "sl"
	case "spanish": return "es"
	case "swahili": return "sw"
	case "swedish": return "sv"
	case "tamil": return "ta"
	case "telugu": return "te"
	case "thai": return "th"
	case "turkish": return "tr"
	case "ukrainian": return "uk"
	case "urdu": return "ur"
	case "uzbek": return "uz"
	case "vietnamese": return "vi"
	case "welsh": return "cy"
	default:
		return "auto"
	}
}
