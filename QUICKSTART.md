# Quick Start Guide

Get your AI Study Companion running in 3 minutes!

## Prerequisites Check

Make sure you have:
- ✅ Node.js 18+ installed
- ✅ OpenAI API key
- ✅ Azure Speech Services key and region

## Step 1: Environment Setup

Your `.env` file should contain:

```env
OPENAI_API_KEY=sk-...
SPEECH_KEY=...
SPEECH_REGION=eastus  # or your region
```

Check your `.env` file now:
```bash
cat .env
```

If you need to add keys, edit `.env`:
```bash
nano .env  # or use your preferred editor
```

## Step 2: Start Everything

Run both servers with one command:

```bash
npm start
```

This will start:
- 🔵 **Backend** on `http://localhost:8787`
- 🟢 **Frontend** on `http://localhost:5173`

## Step 3: Open the Chat Interface

Open your browser to:
```
http://localhost:5173/chat.html
```

## What to Expect

1. **First Load**
   - Live2D character appears on the right
   - Chat interface on the left
   - "New Conversation" button in sidebar

2. **First Conversation**
   - Click "+ New Conversation"
   - AI introduces itself with voice and animation
   - Start chatting!

3. **Try These Features**
   - **Text chat**: Type and press Enter
   - **Voice input**: Click 🎤, speak, click again to send
   - **New topics**: Click "+ New Conversation" anytime
   - **History**: Click any conversation in sidebar

## Troubleshooting

### "Cannot GET /"
✅ Make sure you're going to `/chat.html` not just `/`

### Microphone not working
✅ Allow microphone permissions in your browser
✅ Must use `localhost` or `https://` for mic access

### No audio from AI
✅ Check Azure Speech Services credentials in `.env`
✅ Check browser console for errors
✅ Unmute your computer 😅

### Vector store warnings
✅ Normal on first run - no conversations exist yet
✅ Will work after first conversation is created

### Backend not starting
✅ Check if port 8787 is already in use:
   ```bash
   lsof -i :8787
   ```
✅ Check `.env` file has all required keys

## Usage Tips

### Voice Input Best Practices
- Click mic button to start
- Speak clearly
- Click mic button again to stop and send
- Wait for red animation to stop before speaking again

### Getting Better Responses
- Be specific about your learning goals
- Mention your current level (e.g., "I'm in 10th grade")
- Ask follow-up questions
- Tell the AI if explanations are too complex or too simple

### Leveraging Memory
- The AI remembers ALL past conversations
- Reference previous topics: "Remember when we talked about..."
- Build on earlier lessons: "Can we continue with..."
- Ask for progress tracking: "What have we covered so far?"

## Testing the Retention Features

### Goal Completion Flow
1. Tell the AI you completed a goal:
   > "I just finished preparing for my SAT!"

2. Watch it suggest related subjects:
   - College essay writing
   - Study skills for college
   - AP exam preparation

### Multi-Goal Tracking
1. Set multiple goals:
   > "I want to learn chemistry and improve my math skills"

2. Ask about progress:
   > "Show me my overall progress"

### Session Nudges
The AI tracks engagement and will:
- Encourage booking sessions
- Celebrate milestones
- Suggest practice activities

## Advanced Usage

### Run Servers Separately

Backend only:
```bash
npm run server
```

Frontend only:
```bash
npm run dev
```

### Change Port

Edit `.env`:
```env
PORT=3000  # Change backend port
```

Edit `chat.html` to match:
```javascript
const API_BASE = 'http://localhost:3000';
```

### Custom Voice

In `chat.html`, change the voice:
```javascript
voice: 'en-US-AriaNeural'  // Softer voice
voice: 'en-US-GuyNeural'   // Male voice
```

List all available voices:
```bash
curl http://localhost:8787/voices
```

## Development Workflow

1. **Make changes to chat.html**
   - Vite hot-reloads automatically
   - Refresh browser to see changes

2. **Make changes to server.mjs**
   - Restart the server: `Ctrl+C`, then `npm run server`
   - Or use nodemon: `npx nodemon server.mjs`

3. **Check logs**
   - Frontend: Browser console (F12)
   - Backend: Terminal where you ran `npm start`

## Data Management

### Where Conversations Are Stored
```
data/conversations/*.json
```

### View Conversations
```bash
ls -l data/conversations/
cat data/conversations/<id>.json
```

### Reset Everything
```bash
rm -rf data/conversations/*
```
The app will start fresh on next launch.

### Backup Conversations
```bash
cp -r data/conversations/ data/conversations-backup/
```

## Next Steps

1. ✅ Create your first conversation
2. ✅ Try voice input
3. ✅ Test goal completion flow
4. ✅ Create multiple conversations to see context retrieval
5. ✅ Explore the Live2D emotions by asking emotional questions

## Need Help?

- Check browser console (F12)
- Check server logs in terminal
- Read full README.md for detailed docs
- Verify `.env` file has correct keys

## Quick Commands Reference

```bash
npm start           # Start everything
npm run server      # Backend only
npm run dev         # Frontend only
npm run build       # Build for production

# Debugging
curl http://localhost:8787/health  # Check backend
```

Enjoy your AI Study Companion! 🎓

