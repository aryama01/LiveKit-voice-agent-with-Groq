require('dotenv').config();
const { synthesize } = require('./src/tts');

async function test() {
  console.log('Synthesizing test audio...');
  const buf = await synthesize('Hello, this is a test.');
  console.log(`PCM buffer size: ${buf.length} bytes`);
  console.log(`Expected duration: ${(buf.length / (24000 * 2 * 1)).toFixed(2)} seconds at 24kHz mono`);
  
  // Save to file so we can verify it
  const fs = require('fs');
  fs.writeFileSync('test-output.pcm', buf);
  console.log('Saved to test-output.pcm');
  
  // Also convert back to wav to verify
  const { execSync } = require('child_process');
  execSync('ffmpeg -ar 24000 -ac 1 -f s16le -i test-output.pcm test-output.wav -y', { stdio: 'inherit' });
  console.log('Saved to test-output.wav — open this file to hear if TTS is working');
}

test().catch(console.error);