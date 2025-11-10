import { OpenAI } from 'openai';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('📝 Transcription request received');

  try {
    // Parse form data with formidable
    const form = formidable({
      maxFileSize: 25 * 1024 * 1024, // 25MB
      keepExtensions: true,
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    console.log('📎 Files received:', Object.keys(files));

    const audioFile = files.audio?.[0] || files.audio;
    
    if (!audioFile) {
      console.error('❌ No audio file in request');
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('🎵 Audio file details:', {
      originalFilename: audioFile.originalFilename,
      mimetype: audioFile.mimetype,
      size: audioFile.size,
      filepath: audioFile.filepath,
    });

    // Create a read stream from the temporary file
    const audioStream = fs.createReadStream(audioFile.filepath);
    audioStream.path = audioFile.originalFilename || 'audio.webm';

    console.log('🔊 Sending to OpenAI Whisper...');

    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
    });

    console.log('✅ Transcription successful:', transcription.text.substring(0, 50) + '...');

    // Clean up temp file
    fs.unlinkSync(audioFile.filepath);

    res.status(200).json({ text: transcription.text });
  } catch (error) {
    console.error('❌ Transcription error:', error);
    res.status(500).json({ 
      error: 'Failed to transcribe audio',
      details: error.message 
    });
  }
}

