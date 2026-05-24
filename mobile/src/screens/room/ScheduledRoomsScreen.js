import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Image, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const CATEGORY_COLORS = {
  Music: '#FF6B9D', Gaming: '#6C5CE7', Sports: '#00B894',
  Tech: '#0984E3', Art: '#FDCB6E', Discussion: '#E17055',
  default: '#4FC3F7',
};

function formatScheduledTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today · ${timeStr}`;
  if (isTomorrow) return `Tomorrow · ${timeStr}`;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${timeStr}`;
}

function timeUntil(iso) {
  const diff = new Date(iso) - new Date();
  if (diff <= 0) return 'Starting soon';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h === 0) return `In ${m}m`;
  if (m === 0) return `In ${h}h`;
  return `In ${h}h ${m}m`;
}

function ScheduledRoomCard({ room, onRsvp, onGoLive, isHost }) {
  const catColor = CATEGORY_COLORS[room.category] || CATEGORY_COLORS.default;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.catBadge, { backgroundColor: catColor }]}>
          <Text style={styles.catText}>{room.category || 'General'}</Text>
        </View>
        <View style={styles.countdownBadge}>
          <Ionicons name="time-outline" size={12} color="#4FC3F7" />
          <Text style={styles.countdownText}>{timeUntil(room.scheduled_at)}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>{room.title}</Text>

      <View style={styles.timeRow}>
        <Ionicons name="calendar-outline" size={14} color="#888" />
        <Text style={styles.timeText}>{formatScheduledTime(room.scheduled_at)}</Text>
      </View>

      <View style={styles.hostRow}>
        {room.host_avatar ? (
          <Image source={{ uri: room.host_avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>{(room.host_username || '?')[0].toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.hostName}>@{room.host_username}</Text>
        <View style={styles.rsvpCount}>
          <Ionicons name="people-outline" size={13} color="#aaa" />
          <Text style={styles.rsvpCountText}>{room.rsvp_count || 0} going</Text>
        </View>
      </View>

      {room.description ? (
        <Text style={styles.description} numberOfLines={2}>{room.description}</Text>
      ) : null}

      <View style={styles.footer}>
        {isHost ? (
          <TouchableOpacity style={styles.goLiveBtn} onPress={() => onGoLive(room)}>
            <Ionicons name="radio" size={16} color="#fff" />
            <Text style={styles.goLiveBtnText}>Go Live</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.rsvpBtn, room.has_rsvped && styles.rsvpBtnActive]}
            onPress={() => onRsvp(room)}
          >
            <Ionicons
              name={room.has_rsvped ? 'checkmark-circle' : 'calendar-outline'}
              size={16}
              color={room.has_rsvped ? '#4FC3F7' : '#555'}
            />
            <Text style={[styles.rsvpBtnText, room.has_rsvped && styles.rsvpBtnTextActive]}>
              {room.has_rsvped ? "I'm going" : 'RSVP'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function ScheduledRoomsScreen({ navigation }) {
  const user = useAuthStore((s) => s.user);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRooms = async () => {
    try {
      const res = await api.get('/rooms/scheduled');
      setRooms(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchRooms(); }, []));

  const handleRsvp = async (room) => {
    try {
      if (room.has_rsvped) {
        await api.delete(`/rooms/${room.id}/rsvp`);
        setRooms((prev) => prev.map((r) => r.id === room.id ? { ...r, has_rsvped: false, rsvp_count: Math.max(0, r.rsvp_count - 1) } : r));
      } else {
        await api.post(`/rooms/${room.id}/rsvp`);
        setRooms((prev) => prev.map((r) => r.id === room.id ? { ...r, has_rsvped: true, rsvp_count: r.rsvp_count + 1 } : r));
      }
    } catch (err) {
      Alert.alert('', err.response?.data?.error || 'Failed to update RSVP');
    }
  };

  const handleGoLive = async (room) => {
    try {
      await api.post(`/rooms/${room.id}/go-live`);
      const res = await api.get(`/rooms/${room.id}`);
      navigation.navigate('AudioRoom', { room: res.data });
    } catch (err) {
      Alert.alert('', err.response?.data?.error || 'Failed to start room');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upcoming Rooms</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CreateRoom')}>
          <Ionicons name="add-circle-outline" size={26} color="#4FC3F7" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color="#4FC3F7" size="large" />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRooms(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📅</Text>
              <Text style={styles.emptyTitle}>No upcoming rooms</Text>
              <Text style={styles.emptySub}>Schedule one and get people excited!</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('CreateRoom')}>
                <Text style={styles.emptyBtnText}>Schedule a Room</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <ScheduledRoomCard
              room={item}
              onRsvp={handleRsvp}
              onGoLive={handleGoLive}
              isHost={item.host_id === user?.id}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#222' },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  catBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  catText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  countdownBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(79,195,247,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  countdownText: { fontSize: 11, color: '#4FC3F7', fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 8, lineHeight: 22 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  timeText: { fontSize: 13, color: '#555', fontWeight: '500' },
  hostRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar: { width: 26, height: 26, borderRadius: 13, marginRight: 8 },
  avatarFallback: { backgroundColor: '#4FC3F7', justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: '#fff', fontSize: 11, fontWeight: '700' },
  hostName: { fontSize: 13, color: '#666', fontWeight: '500', flex: 1 },
  rsvpCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rsvpCountText: { fontSize: 12, color: '#aaa' },
  description: { fontSize: 13, color: '#888', lineHeight: 18, marginBottom: 4 },
  footer: { marginTop: 12 },
  rsvpBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, paddingVertical: 10 },
  rsvpBtnActive: { borderColor: '#4FC3F7', backgroundColor: 'rgba(79,195,247,0.08)' },
  rsvpBtnText: { fontSize: 14, fontWeight: '600', color: '#555' },
  rsvpBtnTextActive: { color: '#4FC3F7' },
  goLiveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FF4757', borderRadius: 12, paddingVertical: 10 },
  goLiveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 4 },
  emptySub: { fontSize: 14, color: '#aaa', marginBottom: 24 },
  emptyBtn: { backgroundColor: '#4FC3F7', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
