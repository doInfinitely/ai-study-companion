import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an emotion classifier. Analyze the text and return ONE emotion from this list: happy, sad, angry, surprised, thoughtful, neutral. Return ONLY the emotion word, nothing else.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      max_tokens: 10,
    });

    const emotion = response.choices[0].message.content.trim().toLowerCase();
    res.status(200).json({ emotion });
  } catch (error) {
    console.error('Emotion detection error:', error);
    res.status(500).json({ error: 'Failed to detect emotion', details: error.message });
  }
}

