import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MicSlot({ participant, slotNum, onPress, isSpeaking }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.18, duration: 400, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.setValue(1);
    }
  }, [isSpeaking]);

  if (!participant) {
    return (
      <TouchableOpacity style={styles.emptySlot} onPress={() => onPress?.(slotNum)}>
        <Ionicons name="add" size={24} color="#4FC3F7" />
        <Text style={styles.emptyText}>Slot {slotNum}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.slot}>
      <Animated.View style={[styles.avatarWrap, isSpeaking && { transform: [{ scale: pulse }] }]}>
        {isSpeaking && <View style={styles.speakingRing} />}
        {participant.avatar_url ? (
          <Image source={{ uri: participant.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>
              {(participant.username || '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
        {participant.is_muted && (
          <View style={styles.mutedBadge}>
            <Ionicons name="mic-off" size={10} color="#fff" />
          </View>
        )}
        {participant.role === 'host' && (
          <View style={styles.hostBadge}>
            <Text style={styles.hostBadgeText}>H</Text>
          </View>
        )}
      </Animated.View>
      <Text style={styles.username} numberOfLines={1}>@{participant.username}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { width: '22%', alignItems: 'center', marginBottom: 20, marginHorizontal: '1.5%' },
  emptySlot: {
    width: '22%', aspectRatio: 1, marginBottom: 4, marginHorizontal: '1.5%',
    borderRadius: 40, borderWidth: 2, borderStyle: 'dashed', borderColor: '#4FC3F7',
    justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(79,195,247,0.06)',
  },
  emptyText: { fontSize: 9, color: '#4FC3F7', marginTop: 2 },
  avatarWrap: { position: 'relative', marginBottom: 6 },
  speakingRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 40, borderWidth: 3, borderColor: '#4FC3F7',
    margin: -4,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: { backgroundColor: '#4FC3F7', justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: '#fff', fontSize: 22, fontWeight: '700' },
  mutedBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#FF4757',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#1a1a2e',
  },
  hostBadge: {
    position: 'absolute', top: 0, left: 0,
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFD700',
    justifyContent: 'center', alignItems: 'center',
  },
  hostBadgeText: { fontSize: 9, fontWeight: '800', color: '#333' },
  username: { fontSize: 11, color: '#ccc', textAlign: 'center', width: 70 },
});
