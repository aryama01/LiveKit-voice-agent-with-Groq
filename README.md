# 🎙️ LiveKit Voice Agent (Node.js)

A real-time voice agent that joins a LiveKit room, listens to users via microphone,
transcribes speech using Groq Whisper, generates intelligent responses via Groq LLaMA3,
and replies with synthesized audio — all in real time.

---

## 🏗️ Architecture

```
User Mic → LiveKit Room → Agent
                           ├── VAD (Voice Activity Detection)
                           ├── Groq Whisper (Speech-to-Text)
                           ├── Groq LLaMA3 (LLM Response)
                           ├── gTTS + ffmpeg (Text-to-Speech)
                           └── LiveKit AudioSource (Publish Audio)
```

---

## 📁 Project Structure

```
livekit-voice-agent/
├── src/
│   ├── agent.js          # Main agent — connects to LiveKit, orchestrates pipeline
│   ├── stt.js            # Speech-to-Text using Groq Whisper
│   ├── tts.js            # Text-to-Speech using gTTS + ffmpeg
│   ├── llm.js            # LLM responses using Groq LLaMA3
│   ├── vad.js            # Voice Activity Detection (RMS energy)
│   └── silenceTimer.js   # 20-second silence reminder
├── generate-token.js     # Utility to generate LiveKit test tokens
├── test-client.html      # Browser test client
├── .env.example          # Environment variable template
├── .gitignore
├── package.json
└── README.md
```

---

## ⚙️ Requirements

- **Node.js** >= 18.0.0 (tested on v20.x LTS)
- **ffmpeg** installed and available in PATH
- **LiveKit Cloud** account (free tier) — [https://livekit.io](https://livekit.io)
- **Groq** account (free tier) — [https://console.groq.com](https://console.groq.com)

---

## 🚀 Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/aryama01/LiveKit-voice-agent-with-Groq.git
cd LiveKit-voice-agent-with-Groq
```

### 2. Install dependencies
```bash
npm install
```

### 3. Install ffmpeg

**Windows:**
```bash
winget install ffmpeg
# OR download from https://www.gyan.dev/ffmpeg/builds/
# Extract to C:\ffmpeg and add C:\ffmpeg\bin to your PATH
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
```

Verify:
```bash
ffmpeg -version
```

### 4. Configure environment variables
```bash
cp .env.example .env
```

Fill in your credentials in `.env`.

### 5. Get your credentials

**LiveKit (free):**
1. Sign up at [https://livekit.io](https://livekit.io)
2. Create a project
3. Copy your **API Key**, **API Secret**, and **WebSocket URL**

**Groq (free):**
1. Sign up at [https://console.groq.com](https://console.groq.com)
2. Go to API Keys → Create API Key
3. Same key is used for both Whisper STT and LLaMA3 chat

---

## 🔑 Environment Variables

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_ROOM_NAME=voice-agent-room
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx
```

| Variable | Description | Required |
|---|---|---|
| `LIVEKIT_URL` | LiveKit Cloud WebSocket URL | ✅ |
| `LIVEKIT_API_KEY` | LiveKit API Key from dashboard | ✅ |
| `LIVEKIT_API_SECRET` | LiveKit API Secret from dashboard | ✅ |
| `LIVEKIT_ROOM_NAME` | Room the agent joins (default: `voice-agent-room`) | ✅ |
| `GROQ_API_KEY` | Groq API key for Whisper STT + LLaMA3 | ✅ |

---

## ▶️ How to Run

### Start the agent
```bash
npm start
```

### Development mode (auto-restart)
```bash
npm run dev
```

### Generate a test token
```bash
node generate-token.js
```

---

## 🧪 Testing the Agent

### Option A — Browser test client (recommended)
1. Start the agent: `npm start`
2. Generate a token: `node generate-token.js`
3. Open `test-client.html` in Chrome
4. Paste your LiveKit URL and token → click **Connect**
5. Allow microphone access and speak

### Option B — LiveKit Meet
1. Start the agent: `npm start`
2. Generate a token: `node generate-token.js`
3. Go to [https://meet.livekit.io](https://meet.livekit.io)
4. Enter your LiveKit URL and token → Join

---

## 🧠 How It Works

### No-Overlap / Interrupt Logic

VAD runs on every incoming PCM frame using **RMS energy analysis**:

```
Frame energy > SPEECH_THRESHOLD   →  user is speaking
Silence counter >= SILENCE_FRAMES  →  user stopped speaking
```

**What happens on interrupt:**
```
User speaks mid-response  →  userIsSpeaking = true
                          →  interruptFlag = true
                          →  publishAudio() loop breaks
                          →  audioSource.clearQueue() clears buffer
                          →  agent listens again
```

The agent never talks over the user and stops within one 10ms frame of detecting speech.

### Silence Handling

If no speech is detected for 20 seconds, the agent plays a single reminder — *"Are you still there? I'm listening."* It fires once and resets when the user speaks again. It won't play if the agent is already talking.

### Full Pipeline
```
1. User speaks into mic
2. LiveKit streams 16kHz PCM audio to agent
3. VAD checks every frame for speech activity
4. Groq Whisper transcribes accumulated audio → text
5. Groq LLaMA3 generates a short conversational response
6. gTTS converts text → MP3 → ffmpeg converts to 48kHz PCM
7. Agent publishes frames to LiveKit via AudioSource
8. User hears the response in their browser
```

---

## 📦 SDK & Services Used

| Service | Purpose | Cost |
|---|---|---|
| [`@livekit/rtc-node`](https://github.com/livekit/node-sdks) | Real-time audio streaming | Free |
| [`livekit-server-sdk`](https://github.com/livekit/server-sdk-js) | Token generation | Free |
| [Groq Whisper](https://console.groq.com/docs/speech-text) | STT — `whisper-large-v3-turbo` | Free tier: 7,200s/day |
| [Groq LLaMA3](https://console.groq.com/docs/models) | LLM — `llama3-8b-8192` | Free tier |
| [`node-gtts`](https://www.npmjs.com/package/node-gtts) | Text-to-Speech | Free |
| [ffmpeg](https://ffmpeg.org/) | MP3 → 48kHz PCM conversion | Free |

---

## ⚠️ Known Limitations

- VAD is energy-based and may trigger on loud background noise — tune `SPEECH_THRESHOLD` in `src/vad.js`
- gTTS adds ~0.5–1s latency per response and requires internet
- Short utterances under ~0.2s are skipped to avoid transcribing noise
- Agent joins a single room at startup — no multi-room support
- Conversation history is capped at 10 messages to stay within Groq token limits
- ffmpeg must be installed separately and available in PATH

---

## 🔧 Tuning

| Parameter | File | Default | Description |
|---|---|---|---|
| `SPEECH_THRESHOLD` | `src/vad.js` | `0.008` | Lower = more sensitive |
| `SILENCE_FRAMES` | `src/vad.js` | `40` | Higher = longer pause tolerance |
| `SILENCE_TIMEOUT` | `src/silenceTimer.js` | `20000ms` | Idle time before reminder |
| `max_tokens` | `src/llm.js` | `150` | Max LLM response length |
| `queueSizeMs` | `src/agent.js` | `5000` | Audio queue buffer size |

---
