import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';
import RoomCard from '../../components/RoomCard';

const TABS = ['All', 'Following', 'Music', 'Discussion', 'Gaming', 'Tech'];

export default function HomeScreen({ navigation }) {
  const [rooms, setRooms] = useState([]);
  const [tab, setTab] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [upcomingCount, setUpcomingCount] = useState(0);

  const fetchRooms = async () => {
    try {
      const params = {};
      if (tab === 'Following') params.tab = 'following';
      else if (tab !== 'All') params.category = tab;
      const res = await api.get('/rooms', { params });
      setRooms(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUpcomingCount = async () => {
    try {
      const res = await api.get('/rooms/scheduled');
      setUpcomingCount(res.data.length);
    } catch {}
  };

  useFocusEffect(useCallback(() => { fetchRooms(); fetchUpcomingCount(); }, [tab]));

  const filtered = rooms.filter((r) =>
    !search || r.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>LMK</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => navigation.navigate('ScheduledRooms')} style={styles.calendarBtn}>
            <Ionicons name="calendar-outline" size={22} color="#4FC3F7" />
            {upcomingCount > 0 && (
              <View style={styles.calendarBadge}>
                <Text style={styles.calendarBadgeText}>{upcomingCount > 9 ? '9+' : upcomingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={24} color="#222" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#aaa" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search rooms..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#aaa"
        />
      </View>

      {/* Tab Bar */}
      <FlatList
        horizontal
        data={TABS}
        keyExtractor={(t) => t}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.tab, tab === item && styles.tabActive]}
            onPress={() => setTab(item)}
          >
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Rooms List */}
      {loading ? (
        <ActivityIndicator style={styles.loader} color="#4FC3F7" size="large" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRooms(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎙️</Text>
              <Text style={styles.emptyText}>No live rooms right now</Text>
              <Text style={styles.emptySub}>Be the first to start one!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <RoomCard room={item} onPress={() => navigation.navigate('AudioRoom', { room: item })} />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateRoom')}>
        <Ionicons name="mic" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, backgroundColor: '#fff' },
  logo: { fontSize: 26, fontWeight: '900', color: '#4FC3F7', letterSpacing: -1 },
  headerRight: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  calendarBtn: { position: 'relative' },
  calendarBadge: { position: 'absolute', top: -4, right: -6, backgroundColor: '#FF4757', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  calendarBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginVertical: 10, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#eee' },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10, color: '#222' },
  tabs: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0' },
  tabActive: { backgroundColor: '#4FC3F7' },
  tabText: { fontSize: 13, color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  list: { padding: 16 },
  loader: { flex: 1, marginTop: 60 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#333' },
  emptySub: { fontSize: 14, color: '#aaa', marginTop: 4 },
  fab: { position: 'absolute', bottom: 32, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#4FC3F7', justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#4FC3F7', shadowOpacity: 0.4, shadowRadius: 10 },
});
