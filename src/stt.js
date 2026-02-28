require('dotenv').config();
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function pcmToWav(pcmBuffer) {
  const sampleRate = 16000, numChannels = 1, bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmBuffer]);
}

async function transcribe(pcmBuffer) {
  if (pcmBuffer.length < 3200) return '';

  const wavBuffer = pcmToWav(pcmBuffer);
  const file = new File([wavBuffer], 'audio.wav', { type: 'audio/wav' });

  const response = await groq.audio.transcriptions.create({
    model: 'whisper-large-v3-turbo',
    file,
    language: 'en',
  });

  return response.text.trim();
}

module.exports = { transcribe };