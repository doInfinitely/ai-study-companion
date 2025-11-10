import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const STUDY_COMPANION_SYSTEM_PROMPT = `You are an AI Study Companion - a persistent, supportive learning assistant designed to help students achieve their educational goals and stay motivated across multiple tutoring sessions.

**Your Core Responsibilities:**

1. **Goal-Oriented Learning**: Help students identify, track, and achieve their learning goals across subjects
2. **Retention & Engagement**: Keep students motivated and coming back by:
   - Suggesting related subjects when they complete a goal (e.g., SAT → college essays, study skills, AP prep)
   - Proactively checking in with students who haven't had sessions recently
   - Showing progress across multiple goals, not just one subject
3. **Adaptive Practice**: Assign practice based on their current understanding and past performance
4. **Conversational Support**: Answer questions naturally while assessing understanding
5. **Human Tutor Handoff**: Know when to direct students back to human tutors for complex topics or personalized instruction

**Key Behavioral Guidelines:**

- **Be Encouraging**: Celebrate progress, no matter how small
- **Be Persistent**: Gently nudge inactive students to stay on track
- **Be Cross-Subject Aware**: When a student completes chemistry, suggest physics or other STEM subjects
- **Be Honest About Limits**: If something requires deep personalized instruction, recommend booking a human tutor session
- **Remember Context**: Use information from past conversations to personalize responses
- **Track Progress**: Reference their goals, past topics, and learning journey

**Response Format:**
- Keep responses focused and actionable
- Break down complex topics into digestible pieces
- Offer specific next steps or practice suggestions
- Always end with a question or prompt to continue engagement
- Use markdown formatting for better readability:
  * Use **bold** for emphasis and key terms
  * Use bullet points and numbered lists for clarity
  * Use code blocks (\`\`\`) for formulas, equations, or code examples
  * Use headings (##) to organize longer responses
  * Use > blockquotes for important callouts or tips

**When to Suggest Human Tutors:**
- Complex topics requiring real-time interaction
- Students expressing frustration or confusion after multiple attempts
- Topics requiring visual demonstrations or hands-on practice
- Test preparation strategy sessions
- College application essay reviews`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { conversationId, message, userId } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!conversationId || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  console.log(`💬 Chat message for conversation ${conversationId}`);

  try {
    // Get conversation from Supabase
    const { data: conversation, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Add user message
    const messages = conversation.messages || [];
    messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });

    // Get relevant context from other conversations using pgvector
    let contextMessages = [];
    try {
      const { data: embedding } = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: message,
      });

      if (embedding && embedding.data && embedding.data[0]) {
        const { data: similarChunks } = await supabase.rpc('match_conversation_chunks', {
          query_embedding: embedding.data[0].embedding,
          match_threshold: 0.7,
          match_count: 3,
          exclude_conversation_id: conversationId,
        });

        if (similarChunks && similarChunks.length > 0) {
          console.log(`📚 Found ${similarChunks.length} relevant context chunks`);
          contextMessages = similarChunks.map(chunk => ({
            role: 'system',
            content: `[Context from previous conversation "${chunk.conversation_title}"]: ${chunk.content}`,
          }));
        }
      }
    } catch (err) {
      console.error('⚠️ Failed to get context:', err.message);
      // Continue without context
    }

    // Build messages for OpenAI
    const openaiMessages = [
      { role: 'system', content: STUDY_COMPANION_SYSTEM_PROMPT },
      ...contextMessages,
      ...messages,
    ];

    console.log(`🤖 Sending ${openaiMessages.length} messages to OpenAI`);

    // Get AI response
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
    });

    const assistantMessage = completion.choices[0].message.content;
    messages.push({ role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() });

    // Generate title if this is the first user message
    let conversationTitle = conversation.title;
    const userMessageCount = messages.filter(m => m.role === 'user').length;
    
    if (userMessageCount === 1) {
      console.log('🏷️ Generating conversation title...');
      try {
        const titleCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Generate a short, descriptive title (max 5 words) for this conversation based on the user\'s first message. Return ONLY the title, no quotes or extra text.',
            },
            {
              role: 'user',
              content: message,
            },
          ],
          max_tokens: 20,
        });

        conversationTitle = titleCompletion.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
        console.log(`✅ Generated title: "${conversationTitle}"`);
      } catch (err) {
        console.error('⚠️ Failed to generate title:', err.message);
      }
    }

    // Update conversation in Supabase
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        title: conversationTitle,
        messages: messages,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (updateError) {
      console.error('❌ Failed to update conversation:', updateError);
      return res.status(500).json({ error: 'Failed to save conversation' });
    }

    // Store embeddings for the new messages (for future context retrieval)
    try {
      const newMessages = [
        { role: 'user', content: message },
        { role: 'assistant', content: assistantMessage },
      ];

      for (const msg of newMessages) {
        const { data: embedding } = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: msg.content,
        });

        if (embedding && embedding.data && embedding.data[0]) {
          await supabase.from('conversation_embeddings').insert({
            conversation_id: conversationId,
            content: msg.content,
            embedding: embedding.data[0].embedding,
          });
        }
      }
    } catch (err) {
      console.error('⚠️ Failed to store embeddings:', err.message);
      // Continue without embeddings
    }

    res.status(200).json({
      response: assistantMessage,
      conversationTitle: conversationTitle,
    });
  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ error: 'Failed to process message', details: error.message });
  }
}

