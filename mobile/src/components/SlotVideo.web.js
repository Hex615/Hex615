// Web / Electron video surface for a single slot.
//
// Plays an Agora video track into a DOM node. For a remote participant we play
// their uid's track (and re-play when it becomes available, since publish can
// arrive after this mounts). For the local user (`local`) we play the camera
// preview. The native counterpart (SlotVideo.js) uses RtcSurfaceView instead.
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  playRemoteVideo, stopRemoteVideo,
  playLocalVideo, stopLocalVideo,
  addRemoteVideoListener,
} from '../services/agora';

export default function SlotVideo({ uid, local, style }) {
  const ref = useRef(null);

  useEffect(() => {
    // In react-native-web a host View ref is the underlying DOM element.
    const el = ref.current;
    if (!el) return undefined;

    if (local) {
      playLocalVideo(el);
      return () => stopLocalVideo();
    }

    const tryPlay = () => playRemoteVideo(uid, el);
    tryPlay(); // track may already be available
    const unsubscribe = addRemoteVideoListener(tryPlay); // ...or arrive later
    return () => { unsubscribe(); stopRemoteVideo(uid); };
  }, [uid, local]);

  return <View ref={ref} style={[s.surface, style]} />;
}

const s = StyleSheet.create({
  surface: { overflow: 'hidden', backgroundColor: '#000' },
});
