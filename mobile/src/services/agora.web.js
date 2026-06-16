// Web / Electron implementation of the Agora voice/video service.
//
// react-native-agora is native-only, so on the web platform Metro resolves this
// `.web.js` file instead of `agora.js`. It exposes the same API consumed by
// SplatRoomScreen but is backed by Agora's browser SDK (agora-rtc-sdk-ng).
//
// Audio plays automatically. Remote video tracks are tracked per-uid and handed
// to the UI via the remote-video listener API; SlotVideo.web plays a given uid's
// track into a DOM node so each participant's stream renders in their slot.
import AgoraRTC from 'agora-rtc-sdk-ng';
import api from './api';
import { uidForUser } from './agoraUid';

const PUBLISHER_ROLES = ['owner', 'manager', 'speaker'];

let client = null;
let localAudioTrack = null;
let localVideoTrack = null;

// uid -> remote video track, for uids currently publishing video.
const remoteVideoTracks = new Map();
// Listeners notified (with the current uid array) whenever the set changes.
const remoteVideoListeners = new Set();

function notifyRemoteVideo() {
  const uids = getRemoteVideoUids();
  remoteVideoListeners.forEach((fn) => {
    try { fn(uids); } catch (err) { console.error('[agora-web] listener error', err); }
  });
}

function ensureClient() {
  if (client) return client;
  client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });

  client.on('user-published', async (user, mediaType) => {
    try {
      await client.subscribe(user, mediaType);
      if (mediaType === 'audio') {
        user.audioTrack?.play();
      } else if (mediaType === 'video') {
        remoteVideoTracks.set(user.uid, user.videoTrack);
        notifyRemoteVideo();
      }
    } catch (err) {
      console.error('[agora-web] subscribe failed', err);
    }
  });

  client.on('user-unpublished', (user, mediaType) => {
    if (mediaType === 'video' && remoteVideoTracks.has(user.uid)) {
      remoteVideoTracks.delete(user.uid);
      notifyRemoteVideo();
    }
  });

  client.on('user-left', (user) => {
    if (remoteVideoTracks.has(user.uid)) {
      remoteVideoTracks.delete(user.uid);
      notifyRemoteVideo();
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
  // with uid 0 (valid for any uid). We join with a deterministic uid derived
  // from our userId so other clients can map our stream back to our slot.
  const res = await api.post(`/rooms/${roomId}/agora-token`);
  const { token, appId } = res.data || {};
  const channel = roomId;
  const resolvedAppId = appId || process.env.EXPO_PUBLIC_AGORA_APP_ID || '';
  const myUid = uidForUser(userId);

  const isPublisher = PUBLISHER_ROLES.includes(role);
  await eng.setClientRole(isPublisher ? 'host' : 'audience');

  const uid = await eng.join(resolvedAppId, channel, token || null, myUid);

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
    remoteVideoTracks.clear();
    notifyRemoteVideo();
  }
}

export function destroyAgora() {
  if (!client) return;
  client.removeAllListeners();
  client = null;
  remoteVideoTracks.clear();
  remoteVideoListeners.clear();
}

export function muteLocalAudio(muted) {
  localAudioTrack?.setMuted(muted);
}

export function muteLocalVideo(muted) {
  localVideoTrack?.setMuted(muted);
}

// ── Remote/local video rendering API (consumed by SlotVideo.web) ──────────────

// uids that currently have a remote video track available.
export function getRemoteVideoUids() {
  return Array.from(remoteVideoTracks.keys());
}

export function addRemoteVideoListener(fn) {
  remoteVideoListeners.add(fn);
  return () => remoteVideoListeners.delete(fn);
}

export function removeRemoteVideoListener(fn) {
  remoteVideoListeners.delete(fn);
}

// Play a remote uid's video into a DOM element. Returns true if a track existed.
export function playRemoteVideo(uid, element) {
  const track = remoteVideoTracks.get(uid);
  if (!track || !element) return false;
  track.play(element, { fit: 'cover' });
  return true;
}

export function stopRemoteVideo(uid) {
  remoteVideoTracks.get(uid)?.stop();
}

// Play the local camera preview into a DOM element (self slot).
export function playLocalVideo(element) {
  if (!localVideoTrack || !element) return false;
  localVideoTrack.play(element, { fit: 'cover', mirror: true });
  return true;
}

export function stopLocalVideo() {
  localVideoTrack?.stop();
}
