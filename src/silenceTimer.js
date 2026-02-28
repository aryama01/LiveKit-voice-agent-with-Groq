// src/silenceTimer.js
// Fires a callback if no user speech detected for SILENCE_TIMEOUT ms.
// Resets every time user speaks. Does NOT loop.

const SILENCE_TIMEOUT = 20_000; // 20 seconds

class SilenceTimer {
  constructor(onSilent) {
    this.onSilent  = onSilent;
    this.timer     = null;
    this.fired     = false;
  }

  reset() {
    this.fired = false;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!this.fired) {
        this.fired = true;
        this.onSilent();
      }
    }, SILENCE_TIMEOUT);
  }

  stop() {
    clearTimeout(this.timer);
  }
}

module.exports = { SilenceTimer };