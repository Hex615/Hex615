import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, TextInput, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

function PostCard({ post, currentUserId, onLike }) {
  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        {post.avatar_url ? (
          <Image source={{ uri: post.avatar_url }} style={styles.postAvatar} />
        ) : (
          <View style={[styles.postAvatar, styles.postAvatarFallback]}>
            <Text style={styles.postAvatarLetter}>{(post.username || '?')[0].toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.postMeta}>
          <Text style={styles.postUsername}>@{post.is_anonymous ? 'anonymous' : post.username}</Text>
          <Text style={styles.postTime}>{new Date(post.created_at).toLocaleDateString()}</Text>
        </View>
        {post.type !== 'text' && (
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{post.type.toUpperCase()}</Text>
          </View>
        )}
      </View>

      {post.content && <Text style={styles.postContent}>{post.content}</Text>}
      {post.media_url && <Image source={{ uri: post.media_url }} style={styles.postMedia} />}

      {post.type === 'poll' && post.poll_options && (
        <View style={styles.pollOptions}>
          {JSON.parse(post.poll_options).options?.map((opt, i) => (
            <TouchableOpacity key={i} style={styles.pollOption}>
              <Text style={styles.pollOptionText}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionItem} onPress={() => onLike(post.id)}>
          <Ionicons name={post.is_liked ? 'heart' : 'heart-outline'} size={20} color={post.is_liked ? '#FF6B81' : '#888'} />
          <Text style={styles.actionCount}>{post.like_count}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionItem}>
          <Ionicons name="chatbubble-outline" size={20} color="#888" />
          <Text style={styles.actionCount}>{post.comment_count}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionItem}>
          <Ionicons name="share-outline" size={20} color="#888" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function FeedScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const user = useAuthStore((s) => s.user);

  const fetchFeed = async () => {
    try {
      const res = await api.get('/feed');
      setPosts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchFeed(); }, []));

  const handleLike = async (postId) => {
    try {
      const res = await api.post(`/feed/${postId}/like`);
      setPosts((prev) => prev.map((p) =>
        p.id === postId
          ? { ...p, is_liked: res.data.liked, like_count: p.like_count + (res.data.liked ? 1 : -1) }
          : p
      ));
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Feed</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CreatePost')}>
          <Ionicons name="add-circle" size={28} color="#4FC3F7" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFeed(); }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={styles.emptyText}>Nothing here yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <PostCard post={item} currentUserId={user?.id} onLike={handleLike} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 22, fontWeight: '800', color: '#111' },
  postCard: { backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12, borderRadius: 18, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  postAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  postAvatarFallback: { backgroundColor: '#4FC3F7', justifyContent: 'center', alignItems: 'center' },
  postAvatarLetter: { color: '#fff', fontSize: 16, fontWeight: '700' },
  postMeta: { flex: 1 },
  postUsername: { fontSize: 14, fontWeight: '700', color: '#222' },
  postTime: { fontSize: 12, color: '#aaa' },
  typeBadge: { backgroundColor: '#f0f0f0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { fontSize: 10, fontWeight: '700', color: '#666' },
  postContent: { fontSize: 15, color: '#333', lineHeight: 22, marginBottom: 12 },
  postMedia: { width: '100%', height: 220, borderRadius: 12, marginBottom: 12 },
  pollOptions: { gap: 8, marginBottom: 12 },
  pollOption: { backgroundColor: '#f0faff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#d0eefb' },
  pollOptionText: { color: '#4FC3F7', fontWeight: '600', fontSize: 14 },
  postActions: { flexDirection: 'row', gap: 20, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f5f5f5' },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: 13, color: '#888' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyText: { fontSize: 16, color: '#aaa' },
});
