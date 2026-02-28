const originalLog = console.log;
const gtts = require('node-gtts')('en');
console.log = originalLog;

const path = require('path');
const fs   = require('fs');
const { execSync } = require('child_process');
const os   = require('os');

async function synthesize(text) {
  return new Promise((resolve, reject) => {
    const tmpMp3 = path.join(os.tmpdir(), `tts-${Date.now()}.mp3`);
    const tmpPcm = tmpMp3.replace('.mp3', '.pcm');

    gtts.save(tmpMp3, text, () => {
      try {
        execSync(
          `ffmpeg -i "${tmpMp3}" -ar 48000 -ac 1 -f s16le "${tmpPcm}" -y`,
          { stdio: 'ignore' }
        );
        const buffer = fs.readFileSync(tmpPcm);
        fs.unlinkSync(tmpMp3);
        fs.unlinkSync(tmpPcm);
        resolve(buffer);
      } catch (e) {
        console.error('[TTS] ffmpeg error:', e.message);
        reject(e);
      }
    });
  });
}

module.exports = { synthesize };