# LiveKit Voice Agent (Node.js)

A real-time voice agent that joins a LiveKit room, listens to users,
transcribes speech, and responds with synthesized audio.

## Architecture

User mic → LiveKit → Agent (STT → Reply → TTS) → LiveKit → User speaker

## No-Overlap / Interrupt Logic

- **VAD** (Voice Activity Detection) runs on every PCM frame using RMS energy.
- When `onSpeechStart` fires → `userIsSpeaking = true` and `interruptFlag = true`.
- The `publishAudio()` loop checks `interruptFlag` between every 10ms frame.
- The agent will **never speak while the user is speaking**.
- If the agent is mid-sentence and the user starts talking, playback stops immediately.

## Silence Handling

- A `SilenceTimer` resets every time user speech starts.
- If 20 seconds pass with no speech, the agent says *"Are you still there?"* once.
- It does **not** loop or play continuously.

## Requirements

- Node.js >= 18.0.0
- LiveKit Cloud account (free tier): https://livekit.io
- OpenAI API key (for Whisper STT + TTS)

## Setup
```bash
git clone <your-repo>
cd livekit-voice-agent
npm install
cp .env.example .env
# Edit .env with your credentials
```

## Environment Variables

| Variable | Description |
|---|---|
| `LIVEKIT_URL` | wss://your-project.livekit.cloud |
| `LIVEKIT_API_KEY` | From LiveKit dashboard |
| `LIVEKIT_API_SECRET` | From LiveKit dashboard |
| `LIVEKIT_ROOM_NAME` | Room to join (default: voice-agent-room) |
| `OPENAI_API_KEY` | OpenAI API key |

## Running
```bash
npm start
# or for development with auto-restart:
npm run dev
```

To test, join the same LiveKit room via https://meet.livekit.io using your room name.

## SDK & Services

- **@livekit/rtc-node** — LiveKit Node.js real-time SDK
- **livekit-server-sdk** — Token generation
- **OpenAI Whisper** — Speech-to-Text
- **OpenAI TTS (tts-1)** — Text-to-Speech

## Known Limitations

- VAD energy threshold may need tuning per microphone/environment
- No persistent conversation history (each utterance is stateless)
- STT requires reasonable audio quality (noisy environments may fail)
- TTS latency ~1–3s depending on OpenAI API response time
```

---

## 📄 Step 11 — `.gitignore`
```
node_modules/
.env
*.log