import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import RoomCard from '../../components/RoomCard';
import { C } from '../../theme';

const TABS = ['All', 'Following', 'Audio', 'Video', 'Music', 'Gaming', 'Tech'];

export default function HomeScreen({ navigation }) {
  const [rooms, setRooms]       = useState([]);
  const [tab, setTab]           = useState('All');
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRooms = async () => {
    try {
      const params = {};
      if (tab === 'Following') params.tab = 'following';
      else if (['Audio', 'Video'].includes(tab)) params.mode = tab.toLowerCase();
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

  useFocusEffect(useCallback(() => { setLoading(true); fetchRooms(); }, [tab]));

  const filtered = rooms.filter((r) =>
    !search || r.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.logo}>Chatsplat</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={24} color={C.white} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={15} color={C.sub} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Search Splat Rooms..."
          placeholderTextColor={C.sub}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Category tabs */}
      <FlatList
        horizontal
        data={TABS}
        keyExtractor={(t) => t}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabs}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.tab, tab === item && s.tabActive]}
            onPress={() => setTab(item)}
          >
            <Text style={[s.tabText, tab === item && s.tabTextActive]}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Rooms */}
      {loading ? (
        <ActivityIndicator style={{ flex: 1, marginTop: 60 }} color={C.purple} size="large" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchRooms(); }}
              tintColor={C.purple}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>⚡</Text>
              <Text style={s.emptyTitle}>No live Splat Rooms</Text>
              <Text style={s.emptySub}>Be the first to start one!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <RoomCard room={item} onPress={() => navigation.navigate('SplatRoom', { room: item })} />
          )}
        />
      )}

      {/* Create room FAB */}
      <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('CreateRoom')}>
        <Ionicons name="add" size={28} color="#000" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  logo:         { fontSize: 24, fontWeight: '900', color: C.purple, letterSpacing: -0.5 },
  searchWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, marginHorizontal: 16, marginBottom: 10, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: C.border },
  searchInput:  { flex: 1, fontSize: 14, paddingVertical: 11, color: C.white },
  tabs:         { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  tab:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  tabActive:    { backgroundColor: C.purple, borderColor: C.purple },
  tabText:      { fontSize: 13, color: C.sub, fontWeight: '600' },
  tabTextActive:{ color: '#fff' },
  list:         { padding: 16 },
  empty:        { alignItems: 'center', paddingTop: 80 },
  emptyEmoji:   { fontSize: 52, marginBottom: 12 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: C.white },
  emptySub:     { fontSize: 14, color: C.sub, marginTop: 6 },
  fab: {
    position: 'absolute', bottom: 28, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.yellow, justifyContent: 'center', alignItems: 'center',
    elevation: 8, shadowColor: C.yellow, shadowOpacity: 0.5, shadowRadius: 12,
  },
});
