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
import SlotTile from '../../components/SlotTile';
import GiftOverlay from '../../components/GiftOverlay';
import { C, SPLAT_GIFTS, getVoltageRank } from '../../theme';

const TOTAL_SLOTS = 20;

export default function SplatRoomScreen({ route, navigation }) {
  const { room } = route.params;
  const user = useAuthStore((s) => s.user);
  const {
    participants, setParticipants, comments, addComment,
    showGift: showGiftOverlay, giftOverlay, leaveRoom,
  } = useRoomStore();

  const [comment, setComment]   = useState('');
  const [socket, setSocket]     = useState(null);
  const [showGifts, setShowGifts] = useState(false);
  const [myRole, setMyRole]     = useState('viewer');
  const commentsRef             = useRef(null);

  useEffect(() => { initRoom(); return () => cleanup(); }, []);

  const initRoom = async () => {
    try {
      await api.post(`/rooms/${room.id}/join`);
      const res = await api.get(`/rooms/${room.id}`);
      setParticipants(res.data.participants || []);
      const me = (res.data.participants || []).find((p) => p.user_id === user?.id);
      if (me) setMyRole(me.role);

      const sock = await connectSocket();
      if (sock) {
        setSocket(sock);
        sock.emit('join-room', { roomId: room.id });
        sock.on('room-state',   ({ participants: p }) => setParticipants(p));
        sock.on('user-joined',  ({ user: u }) => setParticipants((prev) => [...prev, u]));
        sock.on('user-left',    ({ userId }) => setParticipants((prev) => prev.filter((p) => p.user_id !== userId)));
        sock.on('new-comment',  (msg) => addComment(msg));
        sock.on('gift-received',({ gift, sender }) => showGiftOverlay({ gift, sender }));
        sock.on('cam-blocked',  () => Alert.alert('Blocked', 'Enable your mic before turning on camera.'));
        sock.on('kicked',       () => { Alert.alert('Removed', 'You were removed from this room.'); navigation.goBack(); });
      }
    } catch (err) {
      console.error('Room init error:', err);
    }
  };

  const cleanup = async () => {
    if (socket) {
      socket.emit('leave-room', { roomId: room.id });
      ['room-state','user-joined','user-left','new-comment','gift-received','cam-blocked','kicked']
        .forEach((e) => socket.off(e));
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
      Alert.alert('', err.response?.data?.error || 'Insufficient Spota');
    }
  };

  // Build 20-slot array (null = empty)
  const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) =>
    participants.find((p) => p.mic_slot === i + 1) || null
  );

  const isHost = room.host_id === user?.id;
  const canSpeak = ['owner', 'manager', 'speaker'].includes(myRole);
  const hostRank = getVoltageRank(room.host_voltage || 0);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-down" size={28} color={C.white} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={s.roomTitle} numberOfLines={1}>{room.title}</Text>
          <View style={s.hostLine}>
            <Text style={s.hostName}>@{room.host_username}</Text>
            <View style={[s.rankPill, { borderColor: hostRank.color }]}>
              <Text style={[s.rankText, { color: hostRank.color }]}>⚡ {hostRank.title}</Text>
            </View>
          </View>
        </View>
        <View style={s.livePill}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Mode badge */}
      <View style={s.modeBadgeRow}>
        <View style={s.modeBadge}>
          <Ionicons name={room.mode === 'video' ? 'videocam' : room.mode === 'both' ? 'radio' : 'mic'} size={12} color={C.purple} />
          <Text style={s.modeBadgeText}>{(room.mode || 'audio').toUpperCase()} ROOM</Text>
        </View>
        <Text style={s.slotCount}>{participants.length}/20</Text>
      </View>

      {/* 20-slot 4×5 grid */}
      <View style={s.grid}>
        {slots.map((p, i) => (
          <SlotTile
            key={i}
            participant={p}
            slotNum={i + 1}
            isSpeaking={false}
          />
        ))}
      </View>

      {/* Comments + bottom */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
        <FlatList
          ref={commentsRef}
          data={comments}
          keyExtractor={(_, i) => String(i)}
          onContentSizeChange={() => commentsRef.current?.scrollToEnd()}
          contentContainerStyle={s.commentsList}
          renderItem={({ item }) => (
            <View style={s.commentRow}>
              {item.avatar_url
                ? <Image source={{ uri: item.avatar_url }} style={s.commentAvatar} />
                : <View style={[s.commentAvatar, { backgroundColor: C.purple, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{(item.username||'?')[0].toUpperCase()}</Text>
                  </View>
              }
              <View style={s.bubble}>
                <Text style={s.bubbleUser}>@{item.username}</Text>
                <Text style={s.bubbleText}>{item.content}</Text>
              </View>
            </View>
          )}
        />

        {giftOverlay && <GiftOverlay gift={giftOverlay.gift} sender={giftOverlay.sender} />}

        {/* Gift sheet */}
        {showGifts && (
          <View style={s.giftSheet}>
            <Text style={s.giftSheetTitle}>Send a Splat Gift</Text>
            <FlatList
              horizontal
              data={SPLAT_GIFTS}
              keyExtractor={(g) => g.id}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.giftItem} onPress={() => sendGift(item)}>
                  <Text style={s.giftEmoji}>{item.emoji}</Text>
                  <Text style={s.giftName}>{item.name}</Text>
                  <Text style={s.giftCost}>{item.cost} Spota</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Bottom bar */}
        <View style={s.bottomBar}>
          <TextInput
            style={s.commentInput}
            placeholder="Say something..."
            placeholderTextColor={C.sub}
            value={comment}
            onChangeText={setComment}
            onSubmitEditing={sendComment}
            returnKeyType="send"
          />
          <TouchableOpacity style={s.iconBtn} onPress={() => setShowGifts(!showGifts)}>
            <Text style={{ fontSize: 18 }}>💜</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: C.purple }]} onPress={sendComment}>
            <Ionicons name="send" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  roomTitle:      { fontSize: 15, fontWeight: '700', color: C.white },
  hostLine:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  hostName:       { fontSize: 11, color: C.sub },
  rankPill:       { borderRadius: 10, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  rankText:       { fontSize: 10, fontWeight: '700' },
  livePill:       { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,59,92,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 5 },
  liveDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: C.live },
  liveText:       { fontSize: 10, color: C.live, fontWeight: '800', letterSpacing: 1 },
  modeBadgeRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  modeBadge:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.purpleDim, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  modeBadgeText:  { fontSize: 10, color: C.purple, fontWeight: '800', letterSpacing: 0.5 },
  slotCount:      { fontSize: 12, color: C.sub },
  grid:           { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 6 },
  commentsList:   { padding: 12, gap: 8 },
  commentRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  commentAvatar:  { width: 26, height: 26, borderRadius: 13 },
  bubble:         { backgroundColor: C.surface, borderRadius: 14, padding: 8, maxWidth: '80%', borderWidth: 1, borderColor: C.border },
  bubbleUser:     { fontSize: 11, color: C.purple, fontWeight: '700', marginBottom: 2 },
  bubbleText:     { fontSize: 13, color: C.white },
  giftSheet:      { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, borderTopWidth: 1, borderColor: C.border },
  giftSheetTitle: { color: C.white, fontWeight: '700', fontSize: 14, marginBottom: 12 },
  giftItem:       { alignItems: 'center', marginRight: 12, backgroundColor: C.surface2, borderRadius: 14, padding: 12, width: 84, borderWidth: 1, borderColor: C.border },
  giftEmoji:      { fontSize: 30, marginBottom: 4 },
  giftName:       { color: C.white, fontSize: 10, fontWeight: '600', marginBottom: 2, textAlign: 'center' },
  giftCost:       { color: C.yellow, fontSize: 10, fontWeight: '700' },
  bottomBar:      { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: C.surface, gap: 8, borderTopWidth: 1, borderTopColor: C.border },
  commentInput:   { flex: 1, backgroundColor: C.surface2, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, color: C.white, fontSize: 14 },
  iconBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface2, justifyContent: 'center', alignItems: 'center' },
});
