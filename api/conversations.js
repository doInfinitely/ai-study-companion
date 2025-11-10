import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  const { userId } = req.body || req.query;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Create new conversation
  if (req.method === 'POST' && req.url === '/api/conversations') {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          title: 'New Conversation',
          messages: [],
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json(data);
    } catch (error) {
      console.error('Failed to create conversation:', error);
      return res.status(500).json({ error: 'Failed to create conversation' });
    }
  }

  // List conversations
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json(data);
    } catch (error) {
      console.error('Failed to list conversations:', error);
      return res.status(500).json({ error: 'Failed to list conversations' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
