import { getSupabaseClient, getUserFromRequest } from './lib/supabase.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const user = await getUserFromRequest(req);
    const supabase = getSupabaseClient();

    // List conversations
    if (req.method === 'GET' && req.url === '/api/conversations') {
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json({ conversations });
    }

    // Create conversation
    if (req.method === 'POST' && req.url === '/api/conversations') {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert([
          {
            user_id: user.id,
            title: 'New Conversation',
            metadata: {
              sessionCount: 0,
              goals: [],
              subjects: []
            }
          }
        ])
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ conversation });
    }

    // Get single conversation
    if (req.method === 'GET' && req.url.startsWith('/api/conversations/')) {
      const conversationId = req.url.split('/').pop();

      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (convError) throw convError;

      // Get messages for this conversation
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (msgError) throw msgError;

      return res.status(200).json({
        conversation: {
          ...conversation,
          messages
        }
      });
    }

    // Update conversation
    if (req.method === 'PUT' && req.url.startsWith('/api/conversations/')) {
      const conversationId = req.url.split('/').pop();
      const { title, metadata } = req.body;

      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (metadata !== undefined) updateData.metadata = metadata;
      updateData.updated_at = new Date().toISOString();

      const { data: conversation, error } = await supabase
        .from('conversations')
        .update(updateData)
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ conversation });
    }

    // Delete conversation
    if (req.method === 'DELETE' && req.url.startsWith('/api/conversations/')) {
      const conversationId = req.url.split('/').pop();

      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;

      return res.status(204).end();
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('API error:', error);
    
    if (error.message === 'Unauthorized' || error.message.includes('authorization')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

