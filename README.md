# AI Study Companion

A persistent AI companion that lives between tutoring sessions, remembers previous lessons, assigns adaptive practice, answers questions conversationally, and drives students back to human tutors when needed.

## Features

### Core Functionality
- 🤖 **Live2D Animated Avatar** - Expressive character with emotions and lip-sync
- 💬 **Chat Interface** - Clean, modern chat UI with conversation history
- 🎤 **Voice Input** - Speak to the AI using Whisper transcription
- 🔊 **Text-to-Speech** - AI responds with natural voice and animations
- 📚 **Context Retrieval** - Vector store remembers all past conversations
- 🎯 **Multi-Goal Tracking** - Track progress across multiple subjects

### Retention Enhancement
- ✅ **Goal Completion Suggestions** - Automatically suggest related subjects when goals are achieved
  - SAT complete → college essays, study skills, AP prep
  - Chemistry → physics, STEM subjects
  - Math goals → advanced topics
- 📊 **Progress Tracking** - Multi-goal progress tracking (not just single subjects)
- 🔔 **Engagement Nudges** - Proactive reminders for students with <3 sessions by Day 7
- 🎓 **Human Tutor Escalation** - Smart detection of when to route to human tutors

## Setup

### Prerequisites
- Node.js 18+ 
- OpenAI API key
- Azure Speech Services key and region

### Installation

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Configure environment variables:**
Create a `.env` file in the root directory:
```bash
# OpenAI API Key (required for chat and Whisper)
OPENAI_API_KEY=your_openai_api_key_here

# Azure Speech Services (required for TTS)
SPEECH_KEY=your_azure_speech_key_here
SPEECH_REGION=your_azure_region_here
# OR use endpoint directly:
# ENDPOINT=https://your-endpoint.cognitiveservices.azure.com/

# Server Port (optional, defaults to 8787)
PORT=8787
```

3. **Start the backend server:**
```bash
node server.mjs
```

4. **Start the development server:**
```bash
npm run dev
```

5. **Open the chat interface:**
Navigate to `http://localhost:5173/chat.html` in your browser.

## Usage

### Starting a New Conversation
1. Click "**+ New Conversation**" in the sidebar
2. The AI will introduce itself and ask about your learning goals
3. Start chatting via text or voice!

### Text Chat
- Type your message in the input box
- Press Enter or click the send button (➤)
- The AI responds with text and voice

### Voice Input
1. Click the microphone button (🎤)
2. Speak your message
3. Click again to stop recording
4. Your speech is automatically transcribed and sent

### Conversation History
- All conversations are saved automatically
- Click any conversation in the sidebar to switch
- Conversations are titled based on your first message
- The AI remembers context from ALL past conversations

## Architecture

### Frontend (`chat.html`)
- Modern chat UI with OpenAI-style sidebar
- Live2D integration for avatar animations
- Voice recording with MediaRecorder API
- Real-time message streaming

### Backend (`server.mjs`)
- **Express API** for all endpoints
- **LlamaIndex** vector store for context retrieval
- **OpenAI GPT-4o-mini** for chat responses
- **OpenAI Whisper** for speech-to-text
- **Azure Speech Services** for text-to-speech with emotions

### Data Storage
- Conversations stored as JSON files in `data/conversations/`
- Vector embeddings for semantic search across all conversations
- Automatic context retrieval on every message

## API Endpoints

### Conversations
- `POST /conversations/create` - Create new conversation
- `POST /conversations/list` - List all conversations
- `POST /conversations/get` - Get conversation by ID

### Chat
- `POST /chat/message` - Send message and get AI response
- `POST /chat/transcribe` - Transcribe audio to text (Whisper)

### TTS & Emotions
- `POST /tts` - Text-to-speech with Azure
- `POST /emotion` - Analyze emotion in text
- `POST /live2d_timeline` - Generate Live2D animations

### Health
- `GET /health` - Check API status
- `GET /voices` - List available TTS voices

## Retention Enhancement Logic

The AI Study Companion is specifically designed to improve student retention:

### 1. Address 52% "Goal Achieved" Churn
When a student completes their goal, the AI:
- Celebrates the achievement
- Suggests 2-3 related subjects or next steps
- Explains the connection to their completed goal
- Encourages setting a new goal

### 2. Proactive Engagement
- Tracks session count and engagement
- Nudges students with <3 sessions by Day 7
- Reminds about upcoming practice or sessions
- Shows enthusiasm for progress

### 3. Multi-Goal Progress Tracking
- Tracks multiple subjects simultaneously
- Shows overall learning journey
- Connects concepts across subjects
- Encourages breadth of learning

### 4. Smart Human Tutor Escalation
The AI knows when to route to human tutors:
- Complex topics requiring deep explanation
- Persistent confusion or frustration
- Topics outside AI knowledge domain
- Emotional support needs
- College/career strategic planning

## Customization

### Changing the Voice
Edit the voice parameter in `chat.html`:
```javascript
voice: 'en-US-JennyNeural'  // Change to any Azure voice
```

Available voices: `en-US-AriaNeural`, `en-US-GuyNeural`, `en-US-JennyNeural`, etc.

### Adjusting AI Personality
Edit `STUDY_COMPANION_SYSTEM_PROMPT` in `server.mjs` to customize:
- Tone and personality
- Response style
- Subject expertise
- Escalation criteria

### Modifying Live2D Model
Replace the model in `public/models/` with your own Live2D Cubism 4.x model.

## Troubleshooting

### "Failed to access microphone"
- Check browser permissions for microphone access
- HTTPS or localhost required for getUserMedia

### "API error" messages
- Verify `.env` file has correct API keys
- Check that server is running on port 8787
- Check console logs in both browser and terminal

### Live2D model not appearing
- Ensure model files are in `public/models/MO.v2.6.2/`
- Check browser console for loading errors
- Verify Cubism Core SDK is loading correctly

### Vector store errors
- First conversation might not have context (expected)
- Vector store builds as conversations are created
- Check server logs for embedding errors

## Development

### Project Structure
```
ai-study-companion/
├── chat.html              # Main chat interface
├── index.html            # Original demo (Live2D test)
├── server.mjs            # Express backend with all APIs
├── package.json          # Dependencies
├── .env                  # Environment variables (create this)
├── public/
│   └── models/           # Live2D model files
├── data/
│   └── conversations/    # Stored conversations (auto-created)
└── uploads/              # Temp audio files (auto-created)
```

### Tech Stack
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Live2D:** Pixi.js, pixi-live2d-display, Cubism SDK
- **Backend:** Node.js, Express
- **AI:** OpenAI GPT-4o-mini, Whisper
- **TTS:** Azure Speech Services
- **Vector Store:** LlamaIndex, OpenAI Embeddings
- **Storage:** File-based JSON (easily upgradeable to database)

## Future Enhancements

Potential improvements:
- [ ] Real-time voice chat (no button press needed)
- [ ] Multi-user support with authentication
- [ ] Dashboard for progress visualization
- [ ] Integration with actual tutoring session recordings
- [ ] Mobile app (React Native)
- [ ] Multiple Live2D character options
- [ ] Spaced repetition flashcard generation
- [ ] Calendar integration for session reminders
- [ ] Parent/teacher progress reports

## License

This project is for educational and demonstration purposes.

## Support

For issues or questions, please check the console logs first (both browser and server) for detailed error messages.

