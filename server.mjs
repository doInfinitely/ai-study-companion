// server.mjs (ESM)
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dotenvLoaded = false;
try { await import('dotenv/config'); dotenvLoaded = true; } catch {}

import sdk from 'microsoft-cognitiveservices-speech-sdk';
import OpenAI from 'openai';
import { Document, VectorStoreIndex, Settings } from 'llamaindex';
import { OpenAIEmbedding, OpenAI as OpenAILLM } from '@llamaindex/openai';

// ---------------------- Express setup ----------------------
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));

// Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// ---------------------- Data Storage ----------------------
const DATA_DIR = path.join(__dirname, 'data');
const CONVERSATIONS_DIR = path.join(DATA_DIR, 'conversations');

// Ensure directories exist
await fs.mkdir(CONVERSATIONS_DIR, { recursive: true });

// In-memory conversation store (in production, use a database)
const conversations = new Map();

// Vector store for context retrieval
let vectorIndex = null;

async function initVectorStore() {
  console.log('📚 Initializing vector store...');
  try {
    // Configure LlamaIndex to use OpenAI embeddings and LLM
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      Settings.embedModel = new OpenAIEmbedding({
        apiKey: apiKey,
        model: 'text-embedding-3-small' // OpenAI's efficient embedding model
      });
      Settings.llm = new OpenAILLM({
        apiKey: apiKey,
        model: 'gpt-4o-mini' // Use same model as chat
      });
      console.log('  ✓ Configured OpenAI embedding model and LLM');
    } else {
      console.error('  ✗ OPENAI_API_KEY not found, cannot initialize embeddings');
      return;
    }
    // Load existing conversations into vector store
    const conversationFiles = await fs.readdir(CONVERSATIONS_DIR).catch(() => []);
    const documents = [];
    
    console.log(`  Found ${conversationFiles.length} files in conversations directory`);
    
    for (const file of conversationFiles) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(CONVERSATIONS_DIR, file);
      const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      
      // Create documents from messages
      if (data.messages && data.messages.length > 0) {
        const text = data.messages
          .map(m => `${m.role}: ${m.content}`)
          .join('\n\n');
        
        documents.push(
          new Document({
            text,
            metadata: {
              conversationId: data.id,
              title: data.title,
              createdAt: data.createdAt
            }
          })
        );
        console.log(`  ✓ Loaded: ${data.title} (${data.messages.length} messages)`);
      }
    }
    
    if (documents.length > 0) {
      console.log(`  Creating vector index from ${documents.length} documents...`);
      vectorIndex = await VectorStoreIndex.fromDocuments(documents);
      console.log(`✅ Vector store initialized successfully with ${documents.length} conversations`);
    } else {
      console.log('⚠️ No existing conversations to load into vector store');
    }
  } catch (err) {
    console.error('❌ Failed to initialize vector store:', err);
    console.error('  Error details:', err.message);
    console.error('  Stack:', err.stack);
  }
}

// Load conversations from disk
async function loadConversations() {
  try {
    const files = await fs.readdir(CONVERSATIONS_DIR).catch(() => []);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(CONVERSATIONS_DIR, file);
      const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      conversations.set(data.id, data);
    }
    console.log(`Loaded ${conversations.size} conversations`);
  } catch (err) {
    console.error('Failed to load conversations:', err);
  }
}

async function saveConversation(conversation) {
  const filePath = path.join(CONVERSATIONS_DIR, `${conversation.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(conversation, null, 2));
  conversations.set(conversation.id, conversation);
}

// Initialize on startup
await loadConversations();
await initVectorStore();

// ---------------------- AI Study Companion System Prompt ----------------------
const STUDY_COMPANION_SYSTEM_PROMPT = `You are an AI Study Companion - a persistent, supportive learning assistant designed to help students achieve their educational goals and stay motivated across multiple tutoring sessions.

**Your Core Mission:**
- Build a continuous relationship with students across sessions
- Track their learning progress and identify patterns
- Provide adaptive practice and answer questions conversationally
- Drive engagement and reduce churn through proactive suggestions
- Know when to guide students back to human tutors for complex topics

**Key Responsibilities:**

1. **Retention Enhancement:**
   - When a student completes their goal, suggest related subjects to maintain engagement
   - Examples:
     * SAT complete → suggest college essays, study skills, AP prep
     * Chemistry mastery → suggest physics, other STEM subjects
     * Math goal achieved → offer advanced topics or related subjects
   - Address the 52% "goal achieved" churn by always having next steps

2. **Proactive Engagement:**
   - Nudge students who have <3 sessions by Day 7 to book their next session
   - Show enthusiasm for their progress and celebrate small wins
   - Track multi-goal progress, not just single subjects
   - Remind students of upcoming practice or sessions

3. **Adaptive Learning:**
   - Remember previous lessons and build on them
   - Identify knowledge gaps and suggest targeted practice
   - Adjust difficulty based on student performance
   - Provide examples relevant to student's context and interests

4. **When to Escalate to Human Tutors:**
   - Complex topics requiring deep explanation
   - Student showing persistent confusion or frustration
   - Topics outside your knowledge domain
   - Emotional support needs beyond your capacity
   - Strategic planning for college applications or career paths

**Conversation Style:**
- Warm, encouraging, and conversational
- Use student's name when known
- Ask clarifying questions to understand their needs
- Celebrate progress and normalize struggle
- Be concise but thorough
- Use emojis sparingly to add warmth

**Context Awareness:**
- You have access to past conversation history through a vector store
- Reference previous topics and progress when relevant
- Build on earlier conversations naturally
- Track goals, subjects, and milestones across sessions

**Response Format:**
- Keep responses focused and actionable
- Break down complex topics into digestible pieces
- Offer specific next steps or practice suggestions
- Always end with a question or prompt to continue engagement

Remember: Your goal is to be a persistent companion that makes learning feel continuous, supported, and achievable. You're not replacing human tutors - you're the bridge between sessions that keeps students engaged and progressing.`;

// ---------------------- Helpers ----------------------
function parseCatalog(txt) {
  // Parses lines like: "- Param156 — [0, 1] (default 0, step ~0.01) — Note"
  const lines = (txt || '').split(/\r?\n/);
  const items = [];
  for (const ln of lines) {
    const m = ln.match(/-\s*([A-Za-z0-9_]+)\s*—\s*\[(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\](?:\s*\(default\s*([-\d.]+).*?\))?(?:\s*—\s*(.*))?$/);
    if (!m) continue;
    const [, id, min, max, dflt, desc] = m;
    const note = (desc || '').toLowerCase();
    items.push({
      id,
      min: Number(min),
      max: Number(max),
      default: isFinite(Number(dflt)) ? Number(dflt) : 0,
      isToggleLike: /piecewise|toggle|categor/i.test(note),
      note: desc || ''
    });
  }
  return items;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function clampTimeline(timeline, defs) {
  if (!timeline) return timeline;
  const byId = new Map(defs.map(d => [d.id, d]));
  const clampMap = (obj) => {
    const out = {};
    for (const [k,v] of Object.entries(obj||{})) {
      const d = byId.get(k);
      if (!d || typeof v !== 'number') continue;
      let vv = clamp(v, d.min, d.max);
      if (d.isToggleLike) vv = Math.round(vv); // snap plateaus
      out[k] = vv;
    }
    return out;
  };
  if (timeline.mode === 'keyframes') {
    timeline.keyframes = (timeline.keyframes||[]).map(kf => ({
      timeMs: Math.max(0, Math.round(kf.timeMs||0)),
      params: clampMap(kf.params||kf.set||{})
    }));
  } else if (timeline.mode === 'fixed_fps' && timeline.fixedFps?.frames) {
    const dtMs = Math.max(8, Math.round(timeline.fixedFps.dtMs || 1000/60));
    timeline.fixedFps.dtMs = dtMs;
    timeline.fixedFps.frames = timeline.fixedFps.frames.map(f => clampMap(f));
  }
  return timeline;
}
function simpleFallbackTimeline({ words=[], visemes=[] }, defs, fps=60) {
  // Very subtle: eyebrow lifts on content words, blink at pauses, tiny head nods at sentence ends.
  const dtMs = Math.round(1000/Math.max(1, fps));
  const dur = Math.max(
    words.reduce((m,w)=>Math.max(m, w.endMs||0), 0),
    visemes.reduce((m,v)=>Math.max(m, v.startMs||0), 0)
  );
  const frames = [];
  const has = (id) => defs.some(d=>d.id===id);
  for (let t=0; t<=dur; t+=dtMs) {
    const f = {};
    // gentle breathing if available
    if (has('ParamBreath')) {
      f.ParamBreath = 0.5 + 0.1*Math.sin((t/1000)*2*Math.PI*0.33);
    }
    // tiny blink every ~3.5s
    if (has('ParamEyeLOpen') && has('ParamEyeROpen')) {
      const phase = Math.floor((t/3500)%1*10);
      if (phase===0) { f.ParamEyeLOpen = 0.1; f.ParamEyeROpen = 0.1; }
    }
    // nod at sentence ends (., !, ?)
    if (has('ParamAngleY')) {
      const end = words.find(w => /[.!?]/.test(w.text) && Math.abs((w.startMs||0)-t) < 200);
      if (end) f.ParamAngleY = 3.0;
    }
    frames.push(f);
  }
  return { mode:'fixed_fps', fixedFps:{ dtMs, frames } };
}

// ---------------------- Azure TTS setup ----------------------
const { SPEECH_KEY, SPEECH_REGION, ENDPOINT, OPENAI_API_KEY } = process.env;
if (!SPEECH_KEY) console.warn('WARN: SPEECH_KEY missing');
if (!SPEECH_REGION && !ENDPOINT) console.warn('WARN: SPEECH_REGION or ENDPOINT required');
if (!OPENAI_API_KEY) console.warn('WARN: OPENAI_API_KEY missing');
console.log('dotenv loaded:', dotenvLoaded, 'region:', SPEECH_REGION || '(via ENDPOINT)');

function makeSpeechConfig({ preferEndpoint = false } = {}) {
  if (preferEndpoint && ENDPOINT) {
    const cfg = sdk.SpeechConfig.fromEndpoint(new URL(ENDPOINT), SPEECH_KEY);
    return cfg;
  }
  if (!SPEECH_REGION) {
    if (!ENDPOINT) throw new Error('No SPEECH_REGION or ENDPOINT provided');
    const cfg = sdk.SpeechConfig.fromEndpoint(new URL(ENDPOINT), SPEECH_KEY);
    return cfg;
  }
  return sdk.SpeechConfig.fromSubscription(SPEECH_KEY, SPEECH_REGION);
}
function azureFormatFromClient(fmt) {
  if ((fmt || '').toLowerCase().includes('mp3')) {
    return sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
  }
  return sdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm;
}
function ok(res, json) { return res.status(200).json(json); }
function fail(res, status, message, details) {
  return res.status(status).json({ error: 'TTS_ERROR', message, details });
}

// ---------------------- Conversation Management Endpoints ----------------------

app.post('/conversations/create', async (req, res) => {
  try {
    const conversation = {
      id: randomUUID(),
      title: 'New Conversation',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        sessionCount: 0,
        goals: [],
        subjects: []
      }
    };
    
    await saveConversation(conversation);
    res.json({ conversationId: conversation.id });
  } catch (err) {
    console.error('Failed to create conversation:', err);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

app.post('/conversations/list', async (req, res) => {
  try {
    const conversationList = Array.from(conversations.values())
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(c => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt,
        messageCount: c.messages?.length || 0
      }));
    
    res.json({ conversations: conversationList });
  } catch (err) {
    console.error('Failed to list conversations:', err);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

app.post('/conversations/get', async (req, res) => {
  try {
    const { conversationId } = req.body;
    const conversation = conversations.get(conversationId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json({
      id: conversation.id,
      title: conversation.title,
      messages: conversation.messages,
      metadata: conversation.metadata
    });
  } catch (err) {
    console.error('Failed to get conversation:', err);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// ---------------------- Chat Endpoints ----------------------

async function getRelevantContext(query, conversationId, limit = 3) {
  if (!vectorIndex) {
    console.log('⚠️ Vector index not initialized');
    return [];
  }
  
  try {
    console.log(`🔍 Querying vector store for: "${query.substring(0, 50)}..."`);
    
    // Use retriever instead of query engine (we just want docs, not a synthesized response)
    const retriever = vectorIndex.asRetriever({ similarityTopK: limit + 2 }); // Get extra in case we filter out current conversation
    const nodes = await retriever.retrieve(query);
    
    console.log(`  Found ${nodes?.length || 0} nodes`);
    
    // Extract relevant context from other conversations
    const contexts = [];
    if (nodes) {
      for (const nodeWithScore of nodes) {
        const metadata = nodeWithScore.node?.metadata || {};
        const text = nodeWithScore.node?.text || nodeWithScore.node?.getContent?.() || '';
        
        console.log(`  - Node from conversation: ${metadata.title} (${metadata.conversationId})`);
        
        if (metadata.conversationId !== conversationId) {
          contexts.push({
            text: text,
            conversationId: metadata.conversationId,
            title: metadata.title,
            score: nodeWithScore.score
          });
          console.log(`    ✓ Added context from: ${metadata.title} (score: ${nodeWithScore.score?.toFixed(3)})`);
          
          // Stop once we have enough contexts from other conversations
          if (contexts.length >= limit) break;
        } else {
          console.log(`    ✗ Skipped (same conversation)`);
        }
      }
    }
    
    console.log(`  📦 Returning ${contexts.length} relevant contexts`);
    return contexts;
  } catch (err) {
    console.error('❌ Failed to retrieve context:', err);
    console.error('  Error details:', err.message);
    return [];
  }
}

app.post('/chat/message', async (req, res) => {
  try {
    const { conversationId, message, isInitial = false } = req.body;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId required' });
    }
    
    const conversation = conversations.get(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Get relevant context from past conversations
    const contexts = await getRelevantContext(
      isInitial ? 'introduction welcome first conversation' : message,
      conversationId
    );
    
    // Build context string
    let contextString = '';
    if (contexts.length > 0) {
      contextString = '\n\n**Relevant context from past conversations:**\n' +
        contexts.map(c => `- ${c.text.substring(0, 200)}...`).join('\n');
    }
    
    // Build messages for OpenAI
    const messages = [
      { role: 'system', content: STUDY_COMPANION_SYSTEM_PROMPT + contextString }
    ];
    
    // Add conversation history
    messages.push(...conversation.messages);
    
    // Handle initial greeting
    if (isInitial) {
      messages.push({
        role: 'user',
        content: 'Please introduce yourself as my AI Study Companion. Be warm, welcoming, and explain how you can help me with my learning journey.'
      });
    } else {
      messages.push({ role: 'user', content: message });
      conversation.messages.push({ role: 'user', content: message });
    }
    
    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500
    });
    
    const response = completion.choices[0].message.content;
    
    // Save assistant response
    conversation.messages.push({ role: 'assistant', content: response });
    conversation.updatedAt = new Date().toISOString();
    
    // Generate smart title from first user message (after initial greeting)
    console.log('=== TITLE GENERATION CHECK ===');
    console.log(`  messages.length: ${conversation.messages.length}`);
    console.log(`  isInitial: ${isInitial}`);
    console.log(`  currentTitle: "${conversation.title}"`);
    console.log(`  message content: "${message}"`);
    
    // Check if this is the first real user message (after greeting)
    const isFirstUserMessage = !isInitial && conversation.title === 'New Conversation';
    console.log(`  isFirstUserMessage: ${isFirstUserMessage}`);
    
    if (isFirstUserMessage) {
      console.log('✓ GENERATING conversation title from user message...');
      try {
        const titleCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: 'Generate a short, descriptive title (max 5 words) for this conversation based on the user\'s first message. Just return the title, nothing else.' 
            },
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 20
        });
        
        const generatedTitle = titleCompletion.choices[0].message.content.trim();
        conversation.title = generatedTitle.substring(0, 60);
        console.log(`✓✓✓ TITLE GENERATED: "${conversation.title}"`);
      } catch (err) {
        console.warn('Failed to generate title, using fallback:', err.message);
        conversation.title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
        console.log(`✓✓✓ FALLBACK TITLE: "${conversation.title}"`);
      }
    } else {
      console.log('✗ NOT generating title');
      console.log(`  Reason: isInitial=${isInitial}, title="${conversation.title}"`);
    }
    console.log('=== END TITLE CHECK ===');
    
    await saveConversation(conversation);
    
    // Update vector store with new messages
    if (vectorIndex && conversation.messages.length > 0) {
      try {
        const text = conversation.messages
          .slice(-2) // Just the latest exchange
          .map(m => `${m.role}: ${m.content}`)
          .join('\n\n');
        
        console.log(`📝 Updating vector store with new messages from "${conversation.title}"`);
        
        const doc = new Document({
          text,
          metadata: {
            conversationId: conversation.id,
            title: conversation.title,
            createdAt: conversation.createdAt
          }
        });
        
        await vectorIndex.insert(doc);
        console.log('  ✓ Vector store updated successfully');
      } catch (err) {
        console.error('❌ Failed to update vector store:', err);
        console.error('  Error details:', err.message);
      }
    } else if (!vectorIndex) {
      console.log('⚠️ Vector index not available for update');
    }
    
    res.json({ 
      response,
      conversationTitle: conversation.title // Return the updated title
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Failed to process message', details: err.message });
  }
});

// ---------------------- Whisper Transcription ----------------------

app.post('/chat/transcribe', upload.single('audio'), async (req, res) => {
  let filePath = null;
  let renamedPath = null;
  
  try {
    if (!req.file) {
      console.error('No file in request');
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    filePath = req.file.path;
    console.log(`Received audio file: ${req.file.originalname}, size: ${req.file.size} bytes, mimetype: ${req.file.mimetype}`);
    
    // Determine proper extension based on mimetype
    let extension = '.webm';
    if (req.file.mimetype) {
      if (req.file.mimetype.includes('webm')) extension = '.webm';
      else if (req.file.mimetype.includes('ogg')) extension = '.ogg';
      else if (req.file.mimetype.includes('mp4')) extension = '.mp4';
      else if (req.file.mimetype.includes('mpeg')) extension = '.mpeg';
      else if (req.file.mimetype.includes('mp3')) extension = '.mp3';
      else if (req.file.mimetype.includes('wav')) extension = '.wav';
    }
    
    // Rename file to have proper extension for Whisper
    renamedPath = filePath + extension;
    await fs.rename(filePath, renamedPath);
    
    console.log(`Renamed to: ${extension}, sending to Whisper API...`);
    
    // Use createReadStream for OpenAI SDK
    const { createReadStream } = await import('fs');
    
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(renamedPath),
      model: 'whisper-1',
      language: 'en'
    });
    
    console.log('Transcription successful:', transcription.text);
    res.json({ text: transcription.text });
  } catch (err) {
    console.error('Transcription error:', err);
    console.error('Error details:', err.message);
    if (err.response) {
      console.error('API response:', err.response.data);
    }
    res.status(500).json({ 
      error: 'Failed to transcribe audio', 
      details: err.message,
      type: err.type || 'unknown'
    });
  } finally {
    // Clean up uploaded files
    if (filePath) {
      try {
        await fs.unlink(filePath).catch(() => {});
      } catch {}
    }
    if (renamedPath) {
      try {
        await fs.unlink(renamedPath).catch(() => {});
      } catch {}
    }
  }
});

// ---------------------- Health & voices ----------------------
app.get('/health', (req, res) => {
  ok(res, {
    status: 'ok',
    node: process.version,
    env: {
      SPEECH_KEY: !!SPEECH_KEY,
      SPEECH_REGION: SPEECH_REGION || null,
      ENDPOINT: ENDPOINT || null,
      OPENAI_API_KEY: !!OPENAI_API_KEY
    }
  });
});

app.get('/voices', async (req, res) => {
  try {
    const cfg = makeSpeechConfig();
    const result = await new Promise((resolve, reject) => {
      sdk.SpeechSynthesizer.getVoicesAsync(cfg, undefined, resolve, reject);
    });
    if (result.reason !== sdk.ResultReason.VoicesListRetrieved) {
      return fail(res, 502, 'Failed to retrieve voices', { reason: result.reason });
    }
    ok(res, { count: result.voices.length, voices: result.voices.map(v => v.name) });
  } catch (err) {
    fail(res, 500, err?.message || 'voices error', {
      name: err?.name, code: err?.code, stack: err?.stack
    });
  }
});

// ---------------------- TTS endpoint ----------------------
app.post('/tts', async (req, res) => {
  const { text, voice = 'en-US-JennyNeural', format = 'mp3', useEndpoint = false } = req.body || {};
  if (!text || typeof text !== 'string') return fail(res, 400, 'Missing "text"');

  let synthesizer;
  try {
    const speechConfig = makeSpeechConfig({ preferEndpoint: useEndpoint });
    speechConfig.speechSynthesisVoiceName = voice;
    speechConfig.speechSynthesisOutputFormat = azureFormatFromClient(format);

    synthesizer = new sdk.SpeechSynthesizer(speechConfig);

    // capture timings
    const words = [];
    const visemes = [];
    synthesizer.synthesisWordBoundary = (_, e) => {
      const kind = e.boundaryType === sdk.SynthesisBoundaryType.Punctuation
        ? 'PunctuationBoundary' : 'WordBoundary';
      words.push({
        startMs: e.audioOffset / 10000,
        endMs: (e.audioOffset + e.duration) / 10000,
        text: e.text,
        boundaryType: kind
      });
    };
    synthesizer.visemeReceived = (_, e) => {
      visemes.push({ startMs: e.audioOffset / 10000, visemeId: e.visemeId });
    };

    const result = await new Promise((resolve, reject) => {
      synthesizer.speakTextAsync(text, resolve, reject);
    });

    if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) {
      const cancel = sdk.CancellationDetails.fromResult(result);
      const reason = cancel?.reason || 'Canceled';
      const code = cancel?.errorCode || 'Unknown';
      const details = cancel?.errorDetails || 'No details';
      return fail(res, 502, `Azure canceled: ${reason} (${code})`, { details });
    }

    const audioBase64 = Buffer.from(result.audioData).toString('base64');
    const mime = format.toLowerCase().includes('mp3') ? 'audio/mpeg' : 'audio/wav';
    return ok(res, { audioBase64, mime, words, visemes });

  } catch (err) {
    return fail(res, 500, err?.message || 'Internal error', {
      name: err?.name,
      code: err?.code || err?.statusCode,
      stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined
    });
  } finally {
    try { synthesizer?.close(); } catch {}
  }
});

// ---------------------- OpenAI client ----------------------
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ---------- Emotion scoring (Responses API with text.format + angry overrides)
app.post('/emotion', async (req, res) => {
  const { text = '' } = req.body || {};
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

    // Pure JSON Schema (no "name" inside the schema object)
    const emotionSchema = {
      type: 'object',
      properties: {
        happiness: { type: 'number', minimum: 0, maximum: 1 },
        confused:  { type: 'number', minimum: 0, maximum: 1 },
        annoyed:   { type: 'number', minimum: 0, maximum: 1 },
        angry:     { type: 'number', minimum: 0, maximum: 1 },
        sad:       { type: 'number', minimum: 0, maximum: 1 }
      },
      required: ['happiness','confused','annoyed','angry','sad'],
      additionalProperties: false
    };

    const system = [
      'Return only a compact JSON object of normalized emotion intensities in [0,1].',
      'Emotions: happiness, confused, annoyed, angry, sad.',
      'No other keys. Be decisive for clear cues.'
    ].join('\n');

    const resp = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        { role: 'system', content: system },
        { role: 'user',   content: text }
      ],
      // ✅ Correct location and required fields for Responses API:
      text: {
        format: {
          type: 'json_schema',
          name: 'EmotionScores',       // <-- required
          strict: true,
          schema: emotionSchema
        }
      },
      max_output_tokens: 512
    });

    let out = {};
    const raw = resp.output_text ?? '';
    if (raw) { try { out = JSON.parse(raw); } catch {} }

    // Rule-based overrides to guarantee obvious anger
    const angryHints = [
      /don'?t\s+piss\s+me\s+off/i,
      /\bi['’]?m\s+angry\b/i,
      /you'?re\s+one\s+of\s+those\s+delinquents/i
    ];
    if (angryHints.some(r => r.test(text))) {
      out.angry   = Math.max(0.9, Number(out.angry   ?? 0));
      out.annoyed = Math.max(0.6, Number(out.annoyed ?? 0));
      out.happiness = Math.min(Number(out.happiness ?? 0), 0.1);
      out.sad       = Math.min(Number(out.sad       ?? 0), 0.2);
      out.confused  = Math.min(Number(out.confused  ?? 0), 0.2);
    }

    const clamp01 = v => Math.min(1, Math.max(0, Number(v ?? 0)));
    return res.json({
      happiness: clamp01(out.happiness),
      confused:  clamp01(out.confused),
      annoyed:   clamp01(out.annoyed),
      angry:     clamp01(out.angry),
      sad:       clamp01(out.sad)
    });
  } catch (err) {
    console.error('emotion error:', err);
    return res.status(200).json({ happiness:0, confused:0, annoyed:0, angry:0, sad:0 });
  }
});

// ---- LIVE2D TIMELINE (planner) — use json_object instead of json_schema ----
app.post('/live2d_timeline', async (req, res) => {
  const { words = [], visemes = [], parameterCatalog = '', fps = 60, strategy = 'auto' } = req.body || {};
  if (!Array.isArray(words) || !Array.isArray(visemes)) {
    return res.status(400).json({ error:'BAD_INPUT', message:'words[] and visemes[] required' });
  }

  const defs = parseCatalog(parameterCatalog);
  if (!defs.length) {
    return res.json(simpleFallbackTimeline({ words, visemes }, [], fps));
  }

  const MAX_PARAMS = 280;
  const trimmed = defs.slice(0, MAX_PARAMS);
  const glossaryLines = trimmed.map(d =>
    `- ${d.id} [${d.min}, ${d.max}]${d.isToggleLike ? ' (toggle-like)' : ''}${d.note ? ` — ${d.note}` : ''}`
  ).join('\n');

  // Heuristic: force angry cues if obvious in text
  const lineText = (words || []).map(w => w?.text || '').join(' ');
  const hintAngry = /don'?t\s+piss\s+me\s+off/i.test(lineText)
                 || /\bi['’]?m\s+angry\b/i.test(lineText)
                 || /you'?re\s+one\s+of\s+those\s+delinquents/i.test(lineText);

  const system = [
    'You control a Live2D avatar by adjusting numeric parameters.',
    'Output a SINGLE JSON object with either:',
    '- Keyframes: {"mode":"keyframes","keyframes":[{"timeMs":<ms>,"params":{"<ParamId>":<number>}}, ...]}',
    '- OR fixed fps: {"mode":"fixed_fps","fixedFps":{"dtMs":<ms_per_frame>,"frames":[{"<ParamId>":<number>}, ...]}}',
    'Rules:',
    '• Use ONLY parameters from the glossary; keep values within [min,max].',
    '• Snap toggle-like params to integers. Do NOT set ParamMouthOpenY (audio drives mouth).',
    '• Use word/viseme timing for subtle brows/eyes/head/accessories.',
    '• Use punctuation (! ? .) for light nods/blinks; keep subtle.',
    '• If hints.angry is true, prefer visible anger cues (veins, stronger brow tilt) using available glossary params.',
    '',
    'Parameter glossary:',
    glossaryLines
  ].join('\n');

  const user = { words, visemes, fps, strategy, hints: { angry: !!hintAngry } };

  try {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

    const resp = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        { role: 'system', content: system },
        { role: 'user',   content: JSON.stringify(user) }
      ],
      // ✅ No schema — let the model return a JSON object, we validate/clamp locally.
      text: { format: { type: 'json_object' } },
      max_output_tokens: 5000
    });

    // Extract JSON safely
    let outJSON = null;
    const textOut = resp.output_text ?? '';
    if (textOut) { try { outJSON = JSON.parse(textOut); } catch {} }

    // Minimal shape checks; fallback if unusable
    const isFixed = outJSON && outJSON.mode === 'fixed_fps' && outJSON.fixedFps && Array.isArray(outJSON.fixedFps.frames);
    const isKeyed = outJSON && outJSON.mode === 'keyframes' && Array.isArray(outJSON.keyframes);
    if (!isFixed && !isKeyed) {
      const fb = simpleFallbackTimeline({ words, visemes }, trimmed, fps);
      return res.json(clampTimeline(fb, trimmed));
    }

    // Clamp to ranges; snap toggles; ensure sane dt/time
    const safe = clampTimeline(outJSON, trimmed);

    // Guard against empty payloads after clamping
    if (safe.mode === 'keyframes' && (!Array.isArray(safe.keyframes) || !safe.keyframes.length)) {
      const fb = simpleFallbackTimeline({ words, visemes }, trimmed, fps);
      return res.json(clampTimeline(fb, trimmed));
    }
    if (safe.mode === 'fixed_fps' && (!safe.fixedFps?.frames?.length)) {
      const fb = simpleFallbackTimeline({ words, visemes }, trimmed, fps);
      return res.json(clampTimeline(fb, trimmed));
    }

    return res.json(safe);
  } catch (err) {
    console.error('live2d_timeline error:', err);
    const fb = simpleFallbackTimeline({ words, visemes }, defs, fps);
    return res.status(200).json(clampTimeline(fb, defs));
  }
});

// ---------------------- Start ----------------------
const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Live2D backend on http://localhost:${PORT}`);
});

