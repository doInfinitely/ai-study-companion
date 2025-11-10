import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }

  try {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.SPEECH_KEY,
      process.env.SPEECH_REGION
    );

    speechConfig.speechSynthesisVoiceName = 'en-US-AvaMultilingualNeural';
    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

    const audioData = await new Promise((resolve, reject) => {
      synthesizer.speakTextAsync(
        text,
        (result) => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            resolve(result.audioData);
          } else {
            reject(new Error(`Speech synthesis failed: ${result.errorDetails}`));
          }
          synthesizer.close();
        },
        (error) => {
          synthesizer.close();
          reject(error);
        }
      );
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.status(200).send(Buffer.from(audioData));
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: 'Failed to synthesize speech', details: error.message });
  }
}

