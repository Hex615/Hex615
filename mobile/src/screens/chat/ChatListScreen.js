import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

export default function ChatListScreen({ navigation }) {
  const [matches, setMatches] = useState([]);

  const fetchMatches = async () => {
    try {
      const res = await api.get('/swipe/matches');
      setMatches(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useFocusEffect(useCallback(() => { fetchMatches(); }, []));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      <FlatList
        data={matches}
        keyExtractor={(m) => m.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyText}>No matches yet</Text>
            <Text style={styles.emptySub}>Swipe to find your people</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('ChatRoom', { match: item })}
          >
            {item.other_avatar ? (
              <Image source={{ uri: item.other_avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarLetter}>{(item.other_username || '?')[0].toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.rowContent}>
              <Text style={styles.username}>@{item.other_username}</Text>
              <Text style={styles.lastMsg} numberOfLines={1}>
                {item.last_message || 'Say hello! 👋'}
              </Text>
            </View>
            {item.unread_count > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread_count}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 22, fontWeight: '800', color: '#111' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f8f8f8' },
  avatar: { width: 52, height: 52, borderRadius: 26, marginRight: 14 },
  avatarFallback: { backgroundColor: '#4FC3F7', justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: '#fff', fontSize: 20, fontWeight: '700' },
  rowContent: { flex: 1 },
  username: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 3 },
  lastMsg: { fontSize: 13, color: '#999' },
  unreadBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#4FC3F7', justifyContent: 'center', alignItems: 'center' },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 100, gap: 8 },
  emptyEmoji: { fontSize: 56 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#333' },
  emptySub: { fontSize: 14, color: '#aaa' },
});
