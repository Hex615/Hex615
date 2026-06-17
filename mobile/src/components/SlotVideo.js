// Native video surface for a single slot.
//
// Renders an Agora video stream with RtcSurfaceView: a remote participant by
// their derived uid, or the local camera preview (`local`, canvas uid 0). The
// web counterpart (SlotVideo.web.js) plays tracks into a DOM node instead.
import React from 'react';
import { StyleSheet } from 'react-native';
import {
  RtcSurfaceView, VideoSourceType, RenderModeType,
} from 'react-native-agora';

export default function SlotVideo({ uid, local, style }) {
  return (
    <RtcSurfaceView
      style={[s.surface, style]}
      canvas={{
        uid: local ? 0 : uid,
        sourceType: local
          ? VideoSourceType.VideoSourceCamera
          : VideoSourceType.VideoSourceRemote,
        renderMode: RenderModeType.RenderModeHidden, // crop/cover to fill
      }}
    />
  );
}

const s = StyleSheet.create({
  surface: { overflow: 'hidden', backgroundColor: '#000' },
});
