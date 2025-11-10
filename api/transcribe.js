import { OpenAI, toFile } from 'openai';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import os from 'os';

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
    // Configure formidable to use /tmp directory (required for Vercel)
    const uploadDir = os.tmpdir();
    console.log('Upload directory:', uploadDir);

    const form = formidable({
      maxFileSize: 25 * 1024 * 1024, // 25MB
      keepExtensions: true,
      uploadDir: uploadDir,
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

    // Verify file exists
    if (!fs.existsSync(audioFile.filepath)) {
      throw new Error(`File not found at ${audioFile.filepath}`);
    }

    // Read the file as a buffer
    const fileBuffer = fs.readFileSync(audioFile.filepath);
    
    // Create a proper filename with extension
    const extension = audioFile.originalFilename?.split('.').pop() || 'webm';
    const filename = `audio.${extension}`;
    
    // Convert buffer to File using OpenAI's helper
    const file = await toFile(fileBuffer, filename, { type: audioFile.mimetype || 'audio/webm' });

    console.log('🔊 Sending to OpenAI Whisper...');

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
    });

    console.log('✅ Transcription successful:', transcription.text.substring(0, 50) + '...');

    // Clean up temp file
    try {
      fs.unlinkSync(audioFile.filepath);
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp file:', cleanupError);
    }

    res.status(200).json({ text: transcription.text });
  } catch (error) {
    console.error('❌ Transcription error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to transcribe audio',
      details: error.message 
    });
  }
}

