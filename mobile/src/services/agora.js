import {
  createAgoraRtcEngine, ClientRoleType, ChannelProfileType,
  RemoteVideoState,
} from 'react-native-agora';
import api from './api';
import { uidForUser } from './agoraUid';

let engine = null;

// uids that currently have a remote video stream flowing.
const remoteVideoUids = new Set();
// Listeners notified (with the current uid array) whenever the set changes.
const remoteVideoListeners = new Set();

function notifyRemoteVideo() {
  const uids = Array.from(remoteVideoUids);
  remoteVideoListeners.forEach((fn) => {
    try { fn(uids); } catch (err) { console.error('[agora] listener error', err); }
  });
}

export async function initAgora() {
  if (engine) return engine;
  engine = createAgoraRtcEngine();
  engine.initialize({
    appId: process.env.EXPO_PUBLIC_AGORA_APP_ID || '',
    channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
  });

  engine.registerEventHandler({
    // Track which remote uids are sending video so the UI can render them.
    onRemoteVideoStateChanged: (_conn, remoteUid, state) => {
      const hasVideo =
        state === RemoteVideoState.RemoteVideoStateStarting ||
        state === RemoteVideoState.RemoteVideoStateDecoding ||
        state === RemoteVideoState.RemoteVideoStateFrozen;
      const had = remoteVideoUids.has(remoteUid);
      if (hasVideo && !had) { remoteVideoUids.add(remoteUid); notifyRemoteVideo(); }
      else if (!hasVideo && had) { remoteVideoUids.delete(remoteUid); notifyRemoteVideo(); }
    },
    onUserOffline: (_conn, remoteUid) => {
      if (remoteVideoUids.delete(remoteUid)) notifyRemoteVideo();
    },
  });

  return engine;
}

export async function joinAgoraChannel(roomId, userId, role, mode) {
  const eng = await initAgora();

  // Fetch token from backend. The endpoint is POST and returns { token, appId };
  // the channel is the room id and the token is built for uid 0 (any uid). We
  // join with a deterministic uid derived from userId so other clients can map
  // our video stream back to our participant slot.
  const res = await api.post(`/rooms/${roomId}/agora-token`);
  const { token } = res.data || {};
  const channel = roomId;
  const uid = uidForUser(userId);

  const isPublisher = ['owner', 'manager', 'speaker'].includes(role);
  eng.setClientRole(isPublisher
    ? ClientRoleType.ClientRoleBroadcaster
    : ClientRoleType.ClientRoleAudience
  );

  // Enable audio always; enable video (send + receive) only if mode allows.
  eng.enableAudio();
  if (mode === 'video' || mode === 'both') {
    eng.enableVideo();
    if (isPublisher) eng.startPreview();
  }

  await eng.joinChannel(token || null, channel, uid, {});
  return { eng, uid };
}

export async function leaveAgoraChannel() {
  if (!engine) return;
  await engine.leaveChannel();
  remoteVideoUids.clear();
  notifyRemoteVideo();
}

export function destroyAgora() {
  if (!engine) return;
  engine.release(); // tears down the native engine and its event handlers
  engine = null;
  remoteVideoUids.clear();
  remoteVideoListeners.clear();
}

export function muteLocalAudio(muted) {
  engine?.muteLocalAudioStream(muted);
}

export function muteLocalVideo(muted) {
  engine?.muteLocalVideoStream(muted);
  engine?.enableLocalVideo(!muted);
}

// ── Remote video rendering API (consumed by SlotVideo native) ─────────────────

export function getRemoteVideoUids() {
  return Array.from(remoteVideoUids);
}

export function addRemoteVideoListener(fn) {
  remoteVideoListeners.add(fn);
  return () => remoteVideoListeners.delete(fn);
}

export function removeRemoteVideoListener(fn) {
  remoteVideoListeners.delete(fn);
}

// Expose the engine so the native RtcSurfaceView can render via context if needed.
export function getEngine() {
  return engine;
}
