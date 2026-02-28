// generate-token.js
require('dotenv').config();
const { AccessToken } = require('livekit-server-sdk');

const token = new AccessToken(
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET,
  { identity: 'test-user' }
);

token.addGrant({
  roomJoin: true,
  room: process.env.LIVEKIT_ROOM_NAME || 'voice-agent-room',
  canPublish: true,
  canSubscribe: true,
});

token.toJwt().then(jwt => {
  console.log('\nYour test token:\n');
  console.log(jwt);
  console.log('\nUse this at: https://meet.livekit.io\n');
});