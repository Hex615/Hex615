import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import { connectSocket } from '../../services/socket';
import useAuthStore from '../../store/authStore';

export default function ChatScreen({ route, navigation }) {
  const { match } = route.params;
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [socket, setSocket] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimer = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    initSocket();
    return () => cleanup();
  }, []);

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/swipe/matches/${match.id}/messages`);
      setMessages(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const initSocket = async () => {
    const sock = await connectSocket();
    if (sock) {
      setSocket(sock);
      sock.emit('join-chat', { matchId: match.id });
      sock.on('new-message', (msg) => {
        setMessages((prev) => [...prev, msg]);
        listRef.current?.scrollToEnd();
      });
      sock.on('typing', ({ userId }) => {
        if (userId !== user?.id) {
          setIsTyping(true);
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setIsTyping(false), 2000);
        }
      });
    }
  };

  const cleanup = () => {
    socket?.off('new-message');
    socket?.off('typing');
    clearTimeout(typingTimer.current);
  };

  const send = async () => {
    if (!text.trim()) return;
    const content = text.trim();
    setText('');
    try {
      const res = await api.post(`/swipe/matches/${match.id}/messages`, { content });
      setMessages((prev) => [...prev, res.data]);
      socket?.emit('send-message', { matchId: match.id, content });
      listRef.current?.scrollToEnd();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTyping = (val) => {
    setText(val);
    socket?.emit('typing', { matchId: match.id });
  };

  const isMe = (msg) => msg.sender_id === user?.id;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        {match.other_avatar ? (
          <Image source={{ uri: match.other_avatar }} style={styles.headerAvatar} />
        ) : (
          <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
            <Text style={styles.headerAvatarLetter}>{(match.other_username || '?')[0].toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.headerName}>@{match.other_username}</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messageList}
        onLayout={() => listRef.current?.scrollToEnd()}
        renderItem={({ item }) => (
          <View style={[styles.bubble, isMe(item) ? styles.bubbleMe : styles.bubbleThem]}>
            <Text style={[styles.bubbleText, isMe(item) && styles.bubbleTextMe]}>
              {item.content}
            </Text>
          </View>
        )}
        ListFooterComponent={isTyping ? (
          <View style={[styles.bubble, styles.bubbleThem]}>
            <Text style={styles.typingDots}>• • •</Text>
          </View>
        ) : null}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            value={text}
            onChangeText={handleTyping}
            onSubmitEditing={send}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity style={[styles.sendBtn, !text.trim() && { opacity: 0.4 }]} onPress={send} disabled={!text.trim()}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 12 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarFallback: { backgroundColor: '#4FC3F7', justifyContent: 'center', alignItems: 'center' },
  headerAvatarLetter: { color: '#fff', fontSize: 14, fontWeight: '700' },
  headerName: { fontSize: 16, fontWeight: '700', color: '#222', flex: 1 },
  messageList: { padding: 16, gap: 8 },
  bubble: { maxWidth: '75%', padding: 12, borderRadius: 18, marginBottom: 4 },
  bubbleMe: { backgroundColor: '#4FC3F7', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#f0f0f0', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: '#222', lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  typingDots: { fontSize: 20, color: '#aaa', letterSpacing: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 10 },
  input: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#4FC3F7', justifyContent: 'center', alignItems: 'center' },
});
