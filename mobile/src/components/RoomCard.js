import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CATEGORY_COLORS = {
  Music: '#FF6B9D', Gaming: '#6C5CE7', Sports: '#00B894',
  Tech: '#0984E3', Art: '#FDCB6E', Discussion: '#E17055',
  default: '#4FC3F7',
};

export default function RoomCard({ room, onPress }) {
  const catColor = CATEGORY_COLORS[room.category] || CATEGORY_COLORS.default;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.categoryBadge, { backgroundColor: catColor }]}>
        <Text style={styles.categoryText}>{room.category || 'General'}</Text>
      </View>

      <Text style={styles.title} numberOfLines={2}>{room.title}</Text>

      <View style={styles.hostRow}>
        {room.host_avatar ? (
          <Image source={{ uri: room.host_avatar }} style={styles.hostAvatar} />
        ) : (
          <View style={[styles.hostAvatar, styles.hostAvatarFallback]}>
            <Text style={styles.hostAvatarLetter}>
              {(room.host_username || '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.hostName}>@{room.host_username}</Text>
        {room.host_is_followed && (
          <View style={styles.followingPill}>
            <Text style={styles.followingText}>Following</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.stat}>
          <Ionicons name="headset-outline" size={14} color="#888" />
          <Text style={styles.statText}>{room.participant_count || 0}</Text>
        </View>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  categoryBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  categoryText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 12, lineHeight: 22 },
  hostRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  hostAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8 },
  hostAvatarFallback: { backgroundColor: '#4FC3F7', justifyContent: 'center', alignItems: 'center' },
  hostAvatarLetter: { color: '#fff', fontSize: 12, fontWeight: '700' },
  hostName: { fontSize: 13, color: '#666', fontWeight: '500', flex: 1 },
  followingPill: { backgroundColor: '#e8f4fd', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  followingText: { fontSize: 10, color: '#4FC3F7', fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: '#888' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF4757', marginLeft: 8 },
  liveText: { fontSize: 10, color: '#FF4757', fontWeight: '800', letterSpacing: 1 },
});
