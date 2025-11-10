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

  // Get user preferences
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('avatar_customization')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw error;
      }

      return res.status(200).json({ 
        customization: data?.avatar_customization || {} 
      });
    } catch (error) {
      console.error('Failed to get preferences:', error);
      return res.status(500).json({ error: 'Failed to get preferences' });
    }
  }

  // Save user preferences
  if (req.method === 'POST') {
    try {
      const { customization } = req.body;

      if (!customization) {
        return res.status(400).json({ error: 'Missing customization data' });
      }

      const { data, error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          avatar_customization: customization,
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Failed to save preferences:', error);
      return res.status(500).json({ error: 'Failed to save preferences' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

