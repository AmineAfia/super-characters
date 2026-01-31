package gemini

const (
	// DefaultModel is the Gemini model used for conversation.
	DefaultModel = "gemini-2.0-flash"

	// BaseURL is the Gemini API endpoint.
	BaseURL = "https://generativelanguage.googleapis.com/v1beta"
)

// ConversationSystemPrompt is the default system prompt for voice conversations.
const ConversationSystemPrompt = `You are a friendly and helpful voice assistant. Keep your responses concise and conversational since they will be spoken aloud. Aim for 1-3 sentences unless the user asks for more detail.`

// MaxConversationTurns is the maximum number of conversation turns to keep in history.
const MaxConversationTurns = 10
