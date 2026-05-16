import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export default function GiftOverlay({ gift, sender }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, tension: 60, friction: 6, useNativeDriver: true }),
      ]),
      Animated.delay(1800),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [gift]);

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <Text style={styles.emoji}>{gift?.emoji || '🎁'}</Text>
        <Text style={styles.giftName}>{gift?.name}</Text>
        <Text style={styles.fromText}>from @{sender}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 30,
    padding: 40, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  emoji: { fontSize: 80, marginBottom: 12 },
  giftName: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 6 },
  fromText: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
});
