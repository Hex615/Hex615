import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';

const MODE_ICON = { audio: 'mic', video: 'videocam', both: 'radio' };

export default function RoomCard({ room, onPress }) {
  const modeIcon = MODE_ICON[room.mode] || 'mic';

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8}>
      <View style={s.topRow}>
        <View style={s.modePill}>
          <Ionicons name={modeIcon} size={11} color={C.purple} />
          <Text style={s.modeText}>{(room.mode || 'audio').toUpperCase()}</Text>
        </View>
        {room.theme_name && (
          <View style={s.themePill}>
            <Text style={s.themeText}>{room.theme_emoji} {room.theme_name}</Text>
          </View>
        )}
        <View style={s.livePill}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>LIVE</Text>
        </View>
      </View>

      <Text style={s.title} numberOfLines={2}>{room.title}</Text>

      <View style={s.hostRow}>
        {room.host_avatar
          ? <Image source={{ uri: room.host_avatar }} style={s.avatar} />
          : <View style={[s.avatar, s.avatarFb]}>
              <Text style={s.avatarLetter}>{(room.host_username||'?')[0].toUpperCase()}</Text>
            </View>
        }
        <Text style={s.hostName}>@{room.host_username}</Text>
        {room.is_locked && <Ionicons name="lock-closed" size={13} color={C.sub} style={{ marginLeft: 6 }} />}
      </View>

      <View style={s.footer}>
        <Ionicons name="people-outline" size={13} color={C.sub} />
        <Text style={s.count}>{room.participant_count || 0}/20</Text>
        {room.participant_count >= 20 && <Text style={s.fullTag}>FULL</Text>}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.surface, borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: C.border,
  },
  topRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  modePill:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.purpleDim, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  modeText:   { fontSize: 9, color: C.purple, fontWeight: '800', letterSpacing: 0.5 },
  themePill:  { backgroundColor: C.surface2, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  themeText:  { fontSize: 9, color: C.sub },
  livePill:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  liveDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: C.live },
  liveText:   { fontSize: 9, color: C.live, fontWeight: '800', letterSpacing: 1 },
  title:      { fontSize: 15, fontWeight: '700', color: C.white, marginBottom: 10, lineHeight: 21 },
  hostRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar:     { width: 24, height: 24, borderRadius: 12, marginRight: 8 },
  avatarFb:   { backgroundColor: C.purple, justifyContent: 'center', alignItems: 'center' },
  avatarLetter:{ color: '#fff', fontSize: 10, fontWeight: '700' },
  hostName:   { fontSize: 12, color: C.sub, flex: 1 },
  footer:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  count:      { fontSize: 12, color: C.sub },
  fullTag:    { marginLeft: 6, fontSize: 9, color: C.yellow, fontWeight: '800', letterSpacing: 0.5 },
});
