// src/vad.js
const SPEECH_THRESHOLD = 0.008;  // slightly lower = more sensitive
const SILENCE_FRAMES   = 40;     // was 15 — now waits ~40 frames before ending utterance

class VAD {
  constructor() {
    this.isSpeaking   = false;
    this.silenceCount = 0;
    this.onSpeechStart = null;
    this.onSpeechEnd   = null;
  }

  processFrame(frame) {
    const samples = frame instanceof Int16Array
      ? frame
      : new Int16Array(frame.buffer, frame.byteOffset, frame.byteLength / 2);

    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      const norm = samples[i] / 32768;
      sum += norm * norm;
    }
    const rms = Math.sqrt(sum / samples.length);

    if (rms > SPEECH_THRESHOLD) {
      this.silenceCount = 0;
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.onSpeechStart && this.onSpeechStart();
      }
    } else {
      this.silenceCount++;
      if (this.isSpeaking && this.silenceCount >= SILENCE_FRAMES) {
        this.isSpeaking = false;
        this.silenceCount = 0;
        this.onSpeechEnd && this.onSpeechEnd();
      }
    }
  }
}

module.exports = { VAD };