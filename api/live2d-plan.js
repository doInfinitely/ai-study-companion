export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { emotion, text } = req.body;

  if (!emotion) {
    return res.status(400).json({ error: 'No emotion provided' });
  }

  // Map emotions to Live2D motion groups
  const emotionToMotion = {
    happy: 'joy',
    sad: 'sad',
    angry: 'angry',
    surprised: 'surprised',
    thoughtful: 'idle',
    neutral: 'idle',
  };

  const motionGroup = emotionToMotion[emotion] || 'idle';

  const plan = {
    emotion,
    motionGroup,
    intensity: 1.0,
  };

  res.status(200).json(plan);
}

