const originalLog = console.log;
const gtts = require('node-gtts')('en');
console.log = originalLog;

const path     = require('path');
const fs       = require('fs');
const { execSync } = require('child_process');
const os       = require('os');
require('dotenv').config();

// Use FFMPEG_PATH from .env or fall back to 'ffmpeg'
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

async function synthesize(text) {
  return new Promise((resolve, reject) => {
    const tmpMp3 = path.join(os.tmpdir(), `tts-${Date.now()}.mp3`);
    const tmpPcm = tmpMp3.replace('.mp3', '.pcm');

    gtts.save(tmpMp3, text, () => {
      if (!fs.existsSync(tmpMp3)) {
        return reject(new Error('gTTS failed to save MP3 file'));
      }

      const fileSize = fs.statSync(tmpMp3).size;
      if (fileSize === 0) {
        return reject(new Error('gTTS saved empty MP3 file'));
      }

      console.log(`[TTS] MP3 saved: ${fileSize} bytes, ffmpeg: ${FFMPEG}`);

      try {
        execSync(
            `"${FFMPEG}" -i "${tmpMp3}" -ar 48000 -ac 1 -f s16le "${tmpPcm}" -y`,
            { stdio: 'pipe' }
        );

        if (!fs.existsSync(tmpPcm)) {
          return reject(new Error('ffmpeg did not produce PCM output'));
        }

        const buffer = fs.readFileSync(tmpPcm);
        console.log(`[TTS] PCM ready: ${buffer.length} bytes`);

        try { fs.unlinkSync(tmpMp3); } catch(_) {}
        try { fs.unlinkSync(tmpPcm); } catch(_) {}

        resolve(buffer);
      } catch (e) {
        console.error('[TTS] ffmpeg error:', e.stderr?.toString() || e.message);
        try { fs.unlinkSync(tmpMp3); } catch(_) {}
        try { fs.unlinkSync(tmpPcm); } catch(_) {}
        reject(e);
      }
    });
  });
}

module.exports = { synthesize };