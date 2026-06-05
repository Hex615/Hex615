// Web/Electron stub for react-native-agora.
// react-native-agora is a native module with no web implementation, so on the
// web platform we swap it (via metro.config.js) for these no-ops. This lets the
// bundle compile and the app launch in Electron. Live audio rooms will not
// actually connect here until Agora's Web SDK (agora-rtc-sdk-ng) is integrated.

const warn = (() => {
  let warned = false;
  return () => {
    if (!warned) {
      warned = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[agora-web-stub] react-native-agora is not available on web/Electron. ' +
          'Audio rooms are disabled until the Agora Web SDK is integrated.'
      );
    }
  };
})();

export const ClientRoleType = {
  ClientRoleBroadcaster: 1,
  ClientRoleAudience: 2,
};

export const ChannelProfileType = {
  ChannelProfileCommunication: 0,
  ChannelProfileLiveBroadcasting: 1,
};

const noop = () => {};
const asyncNoop = async () => {};

export function createAgoraRtcEngine() {
  warn();
  return {
    initialize: noop,
    setClientRole: noop,
    enableAudio: noop,
    enableVideo: noop,
    joinChannel: asyncNoop,
    leaveChannel: asyncNoop,
    release: noop,
    muteLocalAudioStream: noop,
    muteLocalVideoStream: noop,
    registerEventHandler: noop,
    unregisterEventHandler: noop,
    addListener: noop,
    removeAllListeners: noop,
  };
}

export default { createAgoraRtcEngine, ClientRoleType, ChannelProfileType };
