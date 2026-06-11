// Web / Electron implementation of the Agora voice/video service.
//
// react-native-agora is native-only, so on the web platform Metro resolves this
// `.web.js` file instead of `agora.js`. It exposes the same API consumed by
// SplatRoomScreen but is backed by Agora's browser SDK (agora-rtc-sdk-ng).
//
// Audio works fully here. Video tracks are created/published so native clients
// can receive them, but remote video is not rendered — the web room UI has no
// video surface (it shows avatar slots), so we only subscribe-and-play audio.
import AgoraRTC from 'agora-rtc-sdk-ng';
import api from './api';

const PUBLISHER_ROLES = ['owner', 'manager', 'speaker'];

let client = null;
let localAudioTrack = null;
let localVideoTrack = null;

function ensureClient() {
  if (client) return client;
  client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });

  // Play remote users' audio automatically as they publish. Video is subscribed
  // but not rendered (no DOM surface in the web room UI yet).
  client.on('user-published', async (user, mediaType) => {
    try {
      await client.subscribe(user, mediaType);
      if (mediaType === 'audio') user.audioTrack?.play();
    } catch (err) {
      console.error('[agora-web] subscribe failed', err);
    }
  });

  return client;
}

export async function initAgora() {
  return ensureClient();
}

export async function joinAgoraChannel(roomId, userId, role, mode) {
  const eng = ensureClient();

  // Fetch a token from the backend. The token is built for channel = roomId
  // with uid 0 (valid for any uid), so we let Agora assign the uid (null).
  // appId is returned by the backend; fall back to the public env var.
  const res = await api.post(`/rooms/${roomId}/agora-token`);
  const { token, appId } = res.data || {};
  const channel = roomId;
  const resolvedAppId = appId || process.env.EXPO_PUBLIC_AGORA_APP_ID || '';

  const isPublisher = PUBLISHER_ROLES.includes(role);
  await eng.setClientRole(isPublisher ? 'host' : 'audience');

  const uid = await eng.join(resolvedAppId, channel, token || null, null);

  // Only publishers create and push local tracks.
  if (isPublisher) {
    localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    const tracks = [localAudioTrack];
    if (mode === 'video' || mode === 'both') {
      localVideoTrack = await AgoraRTC.createCameraVideoTrack();
      tracks.push(localVideoTrack);
    }
    await eng.publish(tracks);
  }

  return { eng, uid };
}

export async function leaveAgoraChannel() {
  if (!client) return;
  try {
    if (localAudioTrack) { localAudioTrack.stop(); localAudioTrack.close(); }
    if (localVideoTrack) { localVideoTrack.stop(); localVideoTrack.close(); }
    await client.leave();
  } catch (err) {
    console.error('[agora-web] leave failed', err);
  } finally {
    localAudioTrack = null;
    localVideoTrack = null;
  }
}

export function destroyAgora() {
  if (!client) return;
  client.removeAllListeners();
  client = null;
}

export function muteLocalAudio(muted) {
  localAudioTrack?.setMuted(muted);
}

export function muteLocalVideo(muted) {
  localVideoTrack?.setMuted(muted);
}
