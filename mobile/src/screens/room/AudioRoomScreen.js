import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import { connectSocket } from '../../services/socket';
import useAuthStore from '../../store/authStore';
import useRoomStore from '../../store/roomStore';
import MicSlot from '../../components/MicSlot';
import GiftOverlay from '../../components/GiftOverlay';

const MIC_SLOTS = 8;

export default function AudioRoomScreen({ route, navigation }) {
  const { room } = route.params;
  const user = useAuthStore((s) => s.user);
  const { participants, setParticipants, updateMicSlots, comments, addComment, boostCount, setBoostCount, showGift, giftOverlay, leaveRoom } = useRoomStore();
  const [comment, setComment] = useState('');
  const [socket, setSocket] = useState(null);
  const [giftCatalog, setGiftCatalog] = useState([]);
  const [showGifts, setShowGifts] = useState(false);
  const commentsRef = useRef(null);

  useEffect(() => {
    initRoom();
    return () => cleanup();
  }, []);

  const initRoom = async () => {
    try {
      await api.post(`/rooms/${room.id}/join`);
      const res = await api.get(`/rooms/${room.id}`);
      setParticipants(res.data.participants);

      const gifts = await api.get('/gifts/catalog');
      setGiftCatalog(gifts.data);

      const sock = await connectSocket();
      if (sock) {
        setSocket(sock);
        sock.emit('join-room', { roomId: room.id });
        sock.on('room-state', ({ participants: p }) => setParticipants(p));
        sock.on('user-joined', ({ user: u }) => setParticipants((prev) => [...prev, { ...u, role: 'listener' }]));
        sock.on('user-left', ({ userId }) => setParticipants((prev) => prev.filter((p) => p.user_id !== userId)));
        sock.on('mic-update', ({ slots }) => updateMicSlots(slots));
        sock.on('new-comment', (msg) => addComment(msg));
        sock.on('gift-received', ({ gift, sender }) => showGift({ gift, sender }));
        sock.on('boost-update', ({ count }) => setBoostCount(count));
      }
    } catch (err) {
      console.error('Room init error:', err);
    }
  };

  const cleanup = async () => {
    if (socket) {
      socket.emit('leave-room', { roomId: room.id });
      socket.off('room-state');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('mic-update');
      socket.off('new-comment');
      socket.off('gift-received');
      socket.off('boost-update');
    }
    await api.post(`/rooms/${room.id}/leave`).catch(() => {});
    leaveRoom();
  };

  const sendComment = () => {
    if (!comment.trim() || !socket) return;
    socket.emit('room-comment', { roomId: room.id, content: comment.trim() });
    setComment('');
  };

  const sendGift = async (gift) => {
    try {
      await api.post('/gifts/send', { receiver_id: room.host_id, room_id: room.id, gift_id: gift.id });
      socket?.emit('gift-sent', { roomId: room.id, gift, receiver: room.host_id });
      setShowGifts(false);
    } catch (err) {
      Alert.alert('', err.response?.data?.error || 'Failed to send gift');
    }
  };

  const handleBoost = async () => {
    try {
      const res = await api.post(`/rooms/${room.id}/boost`, { amount: 10 });
      socket?.emit('boost', { roomId: room.id, count: res.data.boost_count });
    } catch (err) {
      Alert.alert('', err.response?.data?.error || 'Need more coins');
    }
  };

  const isHost = room.host_id === user?.id;
  const speakerSlots = Array.from({ length: MIC_SLOTS }, (_, i) => {
    return participants.find((p) => p.mic_slot === i + 1) || null;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { navigation.goBack(); }}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          <Text style={styles.roomTitle} numberOfLines={1}>{room.title}</Text>
          <Text style={styles.roomCategory}>{room.category}</Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Boost Bar */}
      <View style={styles.boostBar}>
        <Text style={styles.boostLabel}>⚡ Boost</Text>
        <View style={styles.boostTrack}>
          <View style={[styles.boostFill, { width: `${Math.min((boostCount / 500) * 100, 100)}%` }]} />
        </View>
        <Text style={styles.boostCount}>{boostCount}/500</Text>
      </View>

      {/* Mic Grid */}
      <View style={styles.micGrid}>
        {speakerSlots.map((p, i) => (
          <MicSlot key={i} participant={p} slotNum={i + 1} isSpeaking={false} />
        ))}
      </View>

      {/* Comments */}
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
        <FlatList
          ref={commentsRef}
          data={comments}
          keyExtractor={(_, i) => String(i)}
          onContentSizeChange={() => commentsRef.current?.scrollToEnd()}
          contentContainerStyle={styles.commentsList}
          renderItem={({ item }) => (
            <View style={styles.commentRow}>
              {item.avatar_url
                ? <Image source={{ uri: item.avatar_url }} style={styles.commentAvatar} />
                : <View style={[styles.commentAvatar, styles.commentAvatarFallback]}>
                    <Text style={styles.commentAvatarLetter}>{(item.username || '?')[0].toUpperCase()}</Text>
                  </View>
              }
              <View style={styles.commentBubble}>
                <Text style={styles.commentUser}>@{item.username}</Text>
                <Text style={styles.commentContent}>{item.content}</Text>
              </View>
            </View>
          )}
        />

        {/* Gift Overlay */}
        {giftOverlay && <GiftOverlay gift={giftOverlay.gift} sender={giftOverlay.sender} />}

        {/* Gift Catalog Sheet */}
        {showGifts && (
          <View style={styles.giftSheet}>
            <Text style={styles.giftTitle}>Send a Gift 🎁</Text>
            <FlatList
              horizontal
              data={giftCatalog}
              keyExtractor={(g) => g.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.giftItem} onPress={() => sendGift(item)}>
                  <Text style={styles.giftEmoji}>{item.emoji}</Text>
                  <Text style={styles.giftName}>{item.name}</Text>
                  <Text style={styles.giftCost}>{item.coin_cost} 🪙</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <TextInput
            style={styles.commentInput}
            placeholder="Say something..."
            placeholderTextColor="#666"
            value={comment}
            onChangeText={setComment}
            onSubmitEditing={sendComment}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowGifts(!showGifts)}>
            <Text style={styles.iconBtnText}>🎁</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleBoost}>
            <Text style={styles.iconBtnText}>⚡</Text>
          </TouchableOpacity>
          {sendComment && (
            <TouchableOpacity style={styles.sendBtn} onPress={sendComment}>
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  headerMid: { flex: 1 },
  roomTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  roomCategory: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,71,87,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF4757', marginRight: 4 },
  liveText: { fontSize: 10, color: '#FF4757', fontWeight: '800', letterSpacing: 1 },

  boostBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  boostLabel: { fontSize: 12, color: '#FFD700', fontWeight: '700', width: 54 },
  boostTrack: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  boostFill: { height: '100%', backgroundColor: '#FFD700', borderRadius: 3 },
  boostCount: { fontSize: 11, color: 'rgba(255,255,255,0.5)', width: 44, textAlign: 'right' },

  micGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingVertical: 8 },

  commentsList: { padding: 12, gap: 10 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  commentAvatar: { width: 28, height: 28, borderRadius: 14 },
  commentAvatarFallback: { backgroundColor: '#4FC3F7', justifyContent: 'center', alignItems: 'center' },
  commentAvatarLetter: { color: '#fff', fontSize: 11, fontWeight: '700' },
  commentBubble: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 8, maxWidth: '80%' },
  commentUser: { fontSize: 11, color: '#4FC3F7', fontWeight: '700', marginBottom: 2 },
  commentContent: { fontSize: 13, color: '#fff' },

  giftSheet: { backgroundColor: '#16213e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  giftTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 12 },
  giftItem: { alignItems: 'center', marginRight: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 12, width: 80 },
  giftEmoji: { fontSize: 32, marginBottom: 4 },
  giftName: { color: '#fff', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  giftCost: { color: '#FFD700', fontSize: 10 },

  bottomBar: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#16213e', gap: 8 },
  commentInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', fontSize: 14 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  iconBtnText: { fontSize: 18 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4FC3F7', justifyContent: 'center', alignItems: 'center' },
});
