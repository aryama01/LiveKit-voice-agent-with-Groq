require('dotenv').config();

const {
  Room,
  RoomEvent,
  TrackKind,
  LocalAudioTrack,
  AudioSource,
  AudioFrame,
  TrackPublishOptions,
  TrackSource,
  AudioStream,
} = require('@livekit/rtc-node');

const { AccessToken } = require('livekit-server-sdk');
const { v4: uuidv4 }  = require('uuid');
const { VAD }          = require('./vad');
const { SilenceTimer } = require('./silenceTimer');
const { transcribe }   = require('./stt');
const { synthesize }   = require('./tts');

const LIVEKIT_URL    = process.env.LIVEKIT_URL;
const API_KEY        = process.env.LIVEKIT_API_KEY;
const API_SECRET     = process.env.LIVEKIT_API_SECRET;
const ROOM_NAME      = process.env.LIVEKIT_ROOM_NAME || 'voice-agent-room';
const AGENT_IDENTITY = `agent-${uuidv4().slice(0, 8)}`;

const SAMPLE_RATE = 48000;
const CHANNELS    = 1;

let agentIsSpeaking = false;
let userIsSpeaking  = false;
let interruptFlag   = false;
let audioSource     = null;
let pcmAccumulator  = Buffer.alloc(0);
let isProcessing    = false; // prevent overlapping STT calls

async function generateToken() {
  const token = new AccessToken(API_KEY, API_SECRET, { identity: AGENT_IDENTITY });
  token.addGrant({
    roomJoin    : true,
    room        : ROOM_NAME,
    canPublish  : true,
    canSubscribe: true,
  });
  return await token.toJwt();
}

async function publishAudio(pcmBuffer) {
  if (!audioSource || pcmBuffer.length === 0) return;

  // Save debug wav
  try {
    const { execSync } = require('child_process');
    const fs = require('fs');
    fs.writeFileSync('debug-output.pcm', pcmBuffer);
    execSync(`ffmpeg -ar 48000 -ac 1 -f s16le -i debug-output.pcm debug-output.wav -y`, { stdio: 'ignore' });
    console.log(`[Debug] Saved debug-output.wav — ${pcmBuffer.length} bytes`);
  } catch(e) {}

  agentIsSpeaking = true;
  interruptFlag   = false;

  const SAMPLE_RATE       = 48000;
  const CHANNELS          = 1;
  const SAMPLES_PER_FRAME = 480;                    // 10ms at 48kHz
  const CHUNK_BYTES       = SAMPLES_PER_FRAME * 2;  // 960 bytes

  // Clear any previously queued audio
  audioSource.clearQueue();

  console.log(`[Audio] Publishing ${pcmBuffer.length} bytes as ${Math.ceil(pcmBuffer.length / CHUNK_BYTES)} frames`);

  let frameCount = 0;

  for (let offset = 0; offset < pcmBuffer.length; offset += CHUNK_BYTES) {
    if (interruptFlag || userIsSpeaking) {
      console.log('[Agent] Interrupted');
      audioSource.clearQueue();
      break;
    }

    // Always produce a full 480-sample frame (pad with zeros if needed)
    const frame = AudioFrame.create(SAMPLE_RATE, CHANNELS, SAMPLES_PER_FRAME);

    const end      = Math.min(offset + CHUNK_BYTES, pcmBuffer.length);
    const chunk    = pcmBuffer.slice(offset, end);
    const samples  = Math.floor(chunk.byteLength / 2);
    const src      = new Int16Array(chunk.buffer, chunk.byteOffset, samples);

    // Copy into frame data (rest stays zero-padded)
    frame.data.set(src, 0);

    try {
      await audioSource.captureFrame(frame);
      frameCount++;
    } catch (e) {
      console.error('[Audio] captureFrame error:', e.message);
      break;
    }
  }

  // Wait for all queued audio to finish playing
  if (!interruptFlag && !userIsSpeaking) {
    await audioSource.waitForPlayout();
  }

  console.log(`[Audio] Done — ${frameCount} frames sent`);
  agentIsSpeaking = false;
}

async function handleUtterance() {
  if (pcmAccumulator.length === 0 || isProcessing) return;
  isProcessing = true;

  const audio    = pcmAccumulator;
  pcmAccumulator = Buffer.alloc(0);

  console.log(`[STT] Transcribing ${audio.length} bytes...`);

  try {
    const text = await transcribe(audio);
    if (!text) { console.log('[STT] Empty result'); return; }
    console.log(`[STT] User said: "${text}"`);

    const reply    = `You said: ${text}`;
    console.log(`[TTS] Synthesizing: "${reply}"`);
    const ttsAudio = await synthesize(reply);
    if (!ttsAudio) return;

    if (!userIsSpeaking) {
      await publishAudio(ttsAudio);
    }
  } catch (e) {
    console.error('[Utterance] Error:', e.message);
  } finally {
    isProcessing = false;
  }
}

async function main() {
  console.log(`[Agent] Joining room "${ROOM_NAME}" as "${AGENT_IDENTITY}"...`);

  // Create AudioSource FIRST before connecting
  audioSource = new AudioSource(SAMPLE_RATE, CHANNELS, 5000); // 5 second queue

  const room  = new Room();
  const token = await generateToken();

  const vad = new VAD();

  const silenceTimer = new SilenceTimer(async () => {
    if (agentIsSpeaking || userIsSpeaking) return;
    console.log('[Silence] Playing reminder...');
    try {
      const audio = await synthesize("Are you still there? I'm listening.");
      if (audio) await publishAudio(audio);
    } catch (e) {
      console.error('[Silence] Error:', e.message);
    }
  });

  vad.onSpeechStart = () => {
    console.log('[VAD] Speech start');
    userIsSpeaking = true;
    if (agentIsSpeaking) interruptFlag = true;
    silenceTimer.reset();
  };

  vad.onSpeechEnd = () => {
    console.log('[VAD] Speech end');
    userIsSpeaking = false;
    handleUtterance();
  };

  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    if (track.kind !== TrackKind.KIND_AUDIO) return;
    console.log(`[Room] Audio from: ${participant.identity}`);

    const audioStream = new AudioStream(track, 16000, 1);

    (async () => {
      for await (const frame of audioStream) {
          const buffer = Buffer.from(frame.data.buffer);
          vad.processFrame(buffer);

          // Always accumulate — we reset it when we start processing
          // This ensures we don't miss the first few frames of speech
          if (userIsSpeaking) {
            pcmAccumulator = Buffer.concat([pcmAccumulator, buffer]);
          }
      }
    })().catch(e => console.error('[Stream] Error:', e.message));
  });

  room.on(RoomEvent.ParticipantConnected, (p) => {
    console.log(`[Room] Joined: ${p.identity}`);
    silenceTimer.reset();
  });

  room.on(RoomEvent.Disconnected, () => {
    console.log('[Room] Disconnected');
    silenceTimer.stop();
    process.exit(0);
  });

  // Connect first
  await room.connect(LIVEKIT_URL, token);
  console.log('[Agent] Connected!');

  // Create and publish track AFTER connecting
  const agentTrack = LocalAudioTrack.createAudioTrack('agent-voice', audioSource);
  const pubOptions = new TrackPublishOptions();
  pubOptions.source = TrackSource.SOURCE_MICROPHONE;

  await room.localParticipant.publishTrack(agentTrack, pubOptions);
  console.log('[Agent] Track published. Listening...');

  silenceTimer.reset();

  process.on('SIGINT', async () => {
    console.log('\n[Agent] Shutting down...');
    silenceTimer.stop();
    await room.disconnect();
    process.exit(0);
  });
}

main().catch(console.error);