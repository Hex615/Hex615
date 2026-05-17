import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';

export default function SlotTile({ participant, slotNum, onPress, isSpeaking }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSpeaking) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 500, useNativeDriver: true }),
      ])).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [isSpeaking]);

  if (!participant) {
    return (
      <TouchableOpacity style={s.empty} onPress={() => onPress?.(slotNum)}>
        <Ionicons name="add" size={20} color={C.purple} />
        <Text style={s.emptyNum}>{slotNum}</Text>
      </TouchableOpacity>
    );
  }

  const initial = (participant.username || '?')[0].toUpperCase();
  const isOwner   = participant.role === 'owner';
  const isManager = participant.role === 'manager';

  return (
    <View style={s.slot}>
      <Animated.View style={[s.avatarWrap, { transform: [{ scale: pulse }] }]}>
        {isSpeaking && <View style={s.ring} />}
        {participant.avatar_url
          ? <Image source={{ uri: participant.avatar_url }} style={s.avatar} />
          : <View style={[s.avatar, s.avatarFallback]}>
              <Text style={s.initial}>{initial}</Text>
            </View>
        }
        {participant.mic_on === false && (
          <View style={s.muteBadge}>
            <Ionicons name="mic-off" size={9} color="#fff" />
          </View>
        )}
        {participant.cam_on && (
          <View style={[s.modeBadge, { backgroundColor: C.purple }]}>
            <Ionicons name="videocam" size={8} color="#fff" />
          </View>
        )}
        {isOwner && <View style={[s.roleBadge, { backgroundColor: C.yellow }]}><Text style={s.roleText}>👑</Text></View>}
        {isManager && !isOwner && <View style={[s.roleBadge, { backgroundColor: C.purple }]}><Text style={s.roleText}>M</Text></View>}
      </Animated.View>
      <Text style={s.name} numberOfLines={1}>@{participant.username}</Text>
    </View>
  );
}

const SLOT_W = '23%';
const s = StyleSheet.create({
  slot:       { width: SLOT_W, alignItems: 'center', marginBottom: 16, marginHorizontal: '1%' },
  empty: {
    width: SLOT_W, aspectRatio: 1, marginHorizontal: '1%', marginBottom: 16,
    borderRadius: 36, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.purple,
    justifyContent: 'center', alignItems: 'center', backgroundColor: C.purpleDim,
  },
  emptyNum:   { fontSize: 9, color: C.sub, marginTop: 2 },
  avatarWrap: { position: 'relative', marginBottom: 5 },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36, borderWidth: 2.5, borderColor: C.purple, margin: -4,
  },
  avatar:       { width: 60, height: 60, borderRadius: 30 },
  avatarFallback: { backgroundColor: C.purple, justifyContent: 'center', alignItems: 'center' },
  initial:      { color: '#fff', fontSize: 20, fontWeight: '700' },
  muteBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 16, height: 16, borderRadius: 8, backgroundColor: C.live,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: C.bg,
  },
  modeBadge: {
    position: 'absolute', bottom: 0, left: 0,
    width: 16, height: 16, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: C.bg,
  },
  roleBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
  },
  roleText: { fontSize: 8, fontWeight: '800', color: '#000' },
  name:       { fontSize: 10, color: C.sub, textAlign: 'center', width: 66 },
});
