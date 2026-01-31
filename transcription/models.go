package transcription

// ModelInfo represents information about a Whisper model
type ModelInfo struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	Size         string `json:"size"`
	Description  string `json:"description"`
	Url          string `json:"url"`
	FileName     string `json:"fileName"`
	IsDownloaded bool   `json:"isDownloaded"`
	IsActive     bool   `json:"isActive"`
}

// GetSupportedModels returns the list of all supported Whisper models
func GetSupportedModels() []ModelInfo {
	return []ModelInfo{
		// Tiny models
		{
			Name:        "tiny",
			Type:        "Tiny (Multilingual)",
			Size:        "75 MB",
			Description: "Fastest model with basic accuracy. Good for real-time applications.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
			FileName:    "ggml-tiny.bin",
		},
		{
			Name:        "tiny.en",
			Type:        "Tiny (English)",
			Size:        "75 MB",
			Description: "English-only tiny model. Fastest and most optimized for English speech.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
			FileName:    "ggml-tiny.en.bin",
		},
		{
			Name:        "tiny-q5_1",
			Type:        "Tiny Q5_1 (Multilingual)",
			Size:        "31 MB",
			Description: "Quantized tiny model. Smaller size with minimal accuracy loss.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin",
			FileName:    "ggml-tiny-q5_1.bin",
		},
		{
			Name:        "tiny.en-q5_1",
			Type:        "Tiny Q5_1 (English)",
			Size:        "31 MB",
			Description: "Quantized English-only tiny model. Very fast and compact.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin",
			FileName:    "ggml-tiny.en-q5_1.bin",
		},
		{
			Name:        "tiny-q8_0",
			Type:        "Tiny Q8_0 (Multilingual)",
			Size:        "42 MB",
			Description: "Higher quality quantized tiny model with better accuracy.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q8_0.bin",
			FileName:    "ggml-tiny-q8_0.bin",
		},

		// Base models
		{
			Name:        "base",
			Type:        "Base (Multilingual)",
			Size:        "142 MB",
			Description: "Balanced speed and accuracy. Good default for most applications.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
			FileName:    "ggml-base.bin",
		},
		{
			Name:        "base.en",
			Type:        "Base (English)",
			Size:        "142 MB",
			Description: "English-only base model. Good balance of speed and accuracy for English.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
			FileName:    "ggml-base.en.bin",
		},
		{
			Name:        "base-q5_1",
			Type:        "Base Q5_1 (Multilingual)",
			Size:        "59 MB",
			Description: "Quantized base model. Smaller size with good multilingual support.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin",
			FileName:    "ggml-base-q5_1.bin",
		},
		{
			Name:        "base.en-q5_1",
			Type:        "Base Q5_1 (English)",
			Size:        "59 MB",
			Description: "Quantized English-only base model. Compact and efficient.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin",
			FileName:    "ggml-base.en-q5_1.bin",
		},
		{
			Name:        "base-q8_0",
			Type:        "Base Q8_0 (Multilingual)",
			Size:        "82 MB",
			Description: "High quality quantized base model with excellent accuracy.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q8_0.bin",
			FileName:    "ggml-base-q8_0.bin",
		},

		// Small models
		{
			Name:        "small",
			Type:        "Small (Multilingual)",
			Size:        "466 MB",
			Description: "High accuracy multilingual model. Good for most production use cases.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
			FileName:    "ggml-small.bin",
		},
		{
			Name:        "small.en",
			Type:        "Small (English)",
			Size:        "466 MB",
			Description: "English-only small model. Excellent accuracy for English speech.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin",
			FileName:    "ggml-small.en.bin",
		},
		{
			Name:        "small.en-tdrz",
			Type:        "Small TDRZ (English)",
			Size:        "465 MB",
			Description: "Small English model with speaker diarization support.",
			Url:         "https://huggingface.co/akashmjn/tinydiarize-whisper.cpp/resolve/main/ggml-small.en-tdrz.bin",
			FileName:    "ggml-small.en-tdrz.bin",
		},
		{
			Name:        "small-q5_1",
			Type:        "Small Q5_1 (Multilingual)",
			Size:        "194 MB",
			Description: "Quantized small model. Good balance of size and multilingual accuracy.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin",
			FileName:    "ggml-small-q5_1.bin",
		},
		{
			Name:        "small.en-q5_1",
			Type:        "Small Q5_1 (English)",
			Size:        "194 MB",
			Description: "Quantized English-only small model. High accuracy with smaller footprint.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin",
			FileName:    "ggml-small.en-q5_1.bin",
		},
		{
			Name:        "small-q8_0",
			Type:        "Small Q8_0 (Multilingual)",
			Size:        "270 MB",
			Description: "High quality quantized small model with excellent multilingual accuracy.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q8_0.bin",
			FileName:    "ggml-small-q8_0.bin",
		},

		// Medium models
		{
			Name:        "medium",
			Type:        "Medium (Multilingual)",
			Size:        "1.5 GB",
			Description: "Very high accuracy multilingual model. Best for critical applications.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
			FileName:    "ggml-medium.bin",
		},
		{
			Name:        "medium.en",
			Type:        "Medium (English)",
			Size:        "1.5 GB",
			Description: "English-only medium model. Exceptional accuracy for English speech.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin",
			FileName:    "ggml-medium.en.bin",
		},
		{
			Name:        "medium-q5_0",
			Type:        "Medium Q5_0 (Multilingual)",
			Size:        "610 MB",
			Description: "Quantized medium model. Very high accuracy with reasonable size.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium-q5_0.bin",
			FileName:    "ggml-medium-q5_0.bin",
		},
		{
			Name:        "medium.en-q5_0",
			Type:        "Medium Q5_0 (English)",
			Size:        "610 MB",
			Description: "Quantized English-only medium model. Excellent accuracy with smaller size.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en-q5_0.bin",
			FileName:    "ggml-medium.en-q5_0.bin",
		},
		{
			Name:        "medium-q8_0",
			Type:        "Medium Q8_0 (Multilingual)",
			Size:        "875 MB",
			Description: "High quality quantized medium model with near-original accuracy.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium-q8_0.bin",
			FileName:    "ggml-medium-q8_0.bin",
		},

		// Large models
		{
			Name:        "large-v1",
			Type:        "Large v1 (Multilingual)",
			Size:        "2.9 GB",
			Description: "Original large model. Highest accuracy for multilingual speech.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v1.bin",
			FileName:    "ggml-large-v1.bin",
		},
		{
			Name:        "large-v2",
			Type:        "Large v2 (Multilingual)",
			Size:        "2.9 GB",
			Description: "Improved large model with better accuracy across languages.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v2.bin",
			FileName:    "ggml-large-v2.bin",
		},
		{
			Name:        "large-v2-q5_0",
			Type:        "Large v2 Q5_0 (Multilingual)",
			Size:        "1.1 GB",
			Description: "Quantized large v2 model. High accuracy with manageable size.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v2-q5_0.bin",
			FileName:    "ggml-large-v2-q5_0.bin",
		},
		{
			Name:        "large-v2-q8_0",
			Type:        "Large v2 Q8_0 (Multilingual)",
			Size:        "1.5 GB",
			Description: "High quality quantized large v2 model with excellent accuracy.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v2-q8_0.bin",
			FileName:    "ggml-large-v2-q8_0.bin",
		},
		{
			Name:        "large-v3",
			Type:        "Large v3 (Multilingual)",
			Size:        "2.9 GB",
			Description: "Latest large model. State-of-the-art accuracy across all languages.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin",
			FileName:    "ggml-large-v3.bin",
		},
		{
			Name:        "large-v3-q5_0",
			Type:        "Large v3 Q5_0 (Multilingual)",
			Size:        "1.1 GB",
			Description: "Quantized large v3 model. Best accuracy with reasonable size.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-q5_0.bin",
			FileName:    "ggml-large-v3-q5_0.bin",
		},
		{
			Name:        "large-v3-turbo",
			Type:        "Large v3 Turbo (Multilingual)",
			Size:        "1.5 GB",
			Description: "Optimized large v3 model. Faster inference with minimal accuracy loss.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
			FileName:    "ggml-large-v3-turbo.bin",
		},
		{
			Name:        "large-v3-turbo-q5_0",
			Type:        "Large v3 Turbo Q5_0 (Multilingual)",
			Size:        "547 MB",
			Description: "Quantized turbo model. Fast and accurate with small footprint.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin",
			FileName:    "ggml-large-v3-turbo-q5_0.bin",
		},
		{
			Name:        "large-v3-turbo-q8_0",
			Type:        "Large v3 Turbo Q8_0 (Multilingual)",
			Size:        "748 MB",
			Description: "High quality quantized turbo model. Excellent speed-accuracy balance.",
			Url:         "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q8_0.bin",
			FileName:    "ggml-large-v3-turbo-q8_0.bin",
		},
	}
}
