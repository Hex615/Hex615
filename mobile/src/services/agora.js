import { createAgoraRtcEngine, ClientRoleType, ChannelProfileType } from 'react-native-agora';
import api from './api';

let engine = null;

export async function initAgora() {
  if (engine) return engine;
  engine = createAgoraRtcEngine();
  engine.initialize({
    appId: process.env.EXPO_PUBLIC_AGORA_APP_ID || '',
    channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
  });
  return engine;
}

export async function joinAgoraChannel(roomId, userId, role, mode) {
  const eng = await initAgora();

  // Fetch token from backend
  const res = await api.get(`/rooms/${roomId}/agora-token`);
  const { token, uid, channel } = res.data;

  const isPublisher = ['owner', 'manager', 'speaker'].includes(role);
  eng.setClientRole(isPublisher
    ? ClientRoleType.ClientRoleBroadcaster
    : ClientRoleType.ClientRoleAudience
  );

  // Enable audio always; enable video only if mode allows
  eng.enableAudio();
  if (mode === 'video' || mode === 'both') eng.enableVideo();

  await eng.joinChannel(token, channel, uid, {});
  return { eng, uid };
}

export async function leaveAgoraChannel() {
  if (!engine) return;
  await engine.leaveChannel();
}

export function destroyAgora() {
  if (!engine) return;
  engine.release();
  engine = null;
}

export function muteLocalAudio(muted) {
  engine?.muteLocalAudioStream(muted);
}

export function muteLocalVideo(muted) {
  engine?.muteLocalVideoStream(muted);
}
