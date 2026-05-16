import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

function SwipeCard({ card, style }) {
  return (
    <Animated.View style={[styles.card, style]}>
      {card.avatar_url ? (
        <Image source={{ uri: card.avatar_url }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.cardImageFallback]}>
          <Text style={styles.cardFallbackText}>{(card.username || '?')[0].toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.cardOverlay}>
        <Text style={styles.cardUsername}>@{card.username}</Text>
        {card.age && <Text style={styles.cardAge}>{card.age} yrs</Text>}
        <Text style={styles.cardBio} numberOfLines={2}>{card.bio || ''}</Text>
        <View style={styles.interestRow}>
          {(card.interests || []).slice(0, 4).map((tag) => (
            <View key={tag} style={styles.interestTag}>
              <Text style={styles.interestText}>{tag}</Text>
            </View>
          ))}
        </View>
        {card.mutual_count > 0 && (
          <Text style={styles.mutual}>👥 {card.mutual_count} mutual followers</Text>
        )}
      </View>
    </Animated.View>
  );
}

export default function SwipeScreen({ navigation }) {
  const [cards, setCards] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastAction, setLastAction] = useState(null);
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = translateX.interpolate({ inputRange: [-200, 200], outputRange: ['-20deg', '20deg'] });

  useEffect(() => { fetchCards(); }, []);

  const fetchCards = async () => {
    try {
      const res = await api.get('/swipe/cards');
      setCards(res.data);
      setIdx(0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const swipe = async (direction) => {
    const card = cards[idx];
    if (!card) return;

    const toX = direction === 'right' ? 500 : -500;
    setLastAction(direction);

    Animated.timing(translateX, { toValue: toX, duration: 280, useNativeDriver: true }).start(() => {
      translateX.setValue(0);
      setLastAction(null);
      setIdx((i) => i + 1);
    });

    try {
      const res = await api.post('/swipe', { swiped_id: card.id, direction });
      if (res.data.match) {
        setTimeout(() => navigation.navigate('Chat'), 400);
      }
    } catch {}
  };

  const current = cards[idx];
  const next = cards[idx + 1];

  if (loading) return <ActivityIndicator style={styles.loader} color="#4FC3F7" size="large" />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <TouchableOpacity onPress={fetchCards}>
          <Ionicons name="refresh" size={22} color="#4FC3F7" />
        </TouchableOpacity>
      </View>

      <View style={styles.deck}>
        {!current ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💫</Text>
            <Text style={styles.emptyText}>You've seen everyone!</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={fetchCards}>
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {next && <SwipeCard card={next} style={styles.nextCard} />}
            <SwipeCard
              card={current}
              style={{ transform: [{ translateX }, { rotate }] }}
            />
          </>
        )}
      </View>

      {current && (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, styles.passBtn]} onPress={() => swipe('left')}>
            <Ionicons name="close" size={32} color="#FF6B81" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.likeBtn]} onPress={() => swipe('right')}>
            <Ionicons name="heart" size={32} color="#4FC3F7" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  loader: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: '800', color: '#111' },
  deck: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  card: { position: 'absolute', width: '100%', height: 480, borderRadius: 24, overflow: 'hidden', backgroundColor: '#ddd', elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20 },
  nextCard: { top: 10, transform: [{ scale: 0.95 }] },
  cardImage: { width: '100%', height: '100%' },
  cardImageFallback: { backgroundColor: '#4FC3F7', justifyContent: 'center', alignItems: 'center' },
  cardFallbackText: { fontSize: 80, color: '#fff', fontWeight: '700' },
  cardOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', backgroundColor: 'rgba(0,0,0,0.5)' },
  cardUsername: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  cardAge: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  cardBio: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 10, lineHeight: 18 },
  interestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  interestTag: { backgroundColor: 'rgba(79,195,247,0.3)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  interestText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  mutual: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 40, paddingBottom: 32 },
  actionBtn: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  passBtn: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#FF6B81' },
  likeBtn: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#4FC3F7' },
  empty: { alignItems: 'center', gap: 12 },
  emptyEmoji: { fontSize: 60 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#333' },
  refreshBtn: { backgroundColor: '#4FC3F7', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
  refreshBtnText: { color: '#fff', fontWeight: '700' },
});
