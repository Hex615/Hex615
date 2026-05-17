import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { C } from '../../theme';

const PACKAGES = [
  { id: 'starter',   label: 'Starter',     spota: 100,   price: '$0.99',  bonus: null,         popular: false },
  { id: 'vibe',      label: 'Vibe Pack',   spota: 500,   price: '$3.99',  bonus: '+50 bonus',   popular: false },
  { id: 'loud',      label: 'Loud Pack',   spota: 1500,  price: '$9.99',  bonus: '+250 bonus',  popular: true  },
  { id: 'legend',    label: 'Legend Pack', spota: 5000,  price: '$24.99', bonus: '+1000 bonus', popular: false },
];

const GIFT_PREVIEW = [
  { emoji: '💜', name: 'Purple Bomb',  cost: 50   },
  { emoji: '⚡', name: 'Shock Wave',   cost: 100  },
  { emoji: '🌟', name: 'Nova',         cost: 250  },
  { emoji: '👑', name: 'Loud Crown',   cost: 500  },
  { emoji: '💥', name: 'Chatsplat',    cost: 1000 },
];

export default function BuySpoTaScreen({ navigation }) {
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(null); // package id being purchased

  const handleBuy = async (pkg) => {
    setLoading(pkg.id);
    try {
      // In production: trigger RevenueCat / StoreKit / Google Play purchase
      // then send the transaction_id to the backend for verification
      const res = await api.post('/spota/purchase', {
        package_id: pkg.id,
        transaction_id: `demo_${Date.now()}`, // replace with real receipt
      });
      updateUser({ spota_balance: res.data.new_balance });
      Alert.alert('⚡ Spota added!', `You now have ${res.data.new_balance} Spota.`);
    } catch (err) {
      if (err.response?.status === 409) {
        Alert.alert('', 'This purchase was already processed.');
      } else {
        Alert.alert('Error', err.response?.data?.error || 'Purchase failed');
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Buy Spota</Text>
        <View style={s.balance}>
          <Text style={s.balanceNum}>{user?.spota_balance ?? 0}</Text>
          <Text style={s.balanceLabel}>⚡</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>Spota powers your experience — send gifts, boost rooms, and flex your rank.</Text>

        {/* Packages */}
        {PACKAGES.map((pkg) => (
          <TouchableOpacity
            key={pkg.id}
            style={[s.card, pkg.popular && s.cardPopular]}
            onPress={() => handleBuy(pkg)}
            disabled={!!loading}
            activeOpacity={0.8}
          >
            {pkg.popular && (
              <View style={s.popularBadge}>
                <Text style={s.popularText}>MOST POPULAR</Text>
              </View>
            )}
            <View style={s.cardLeft}>
              <Text style={s.spoTaAmt}>{pkg.spota.toLocaleString()}</Text>
              <Text style={s.spoTaLabel}>Spota</Text>
              {pkg.bonus && <Text style={s.bonus}>{pkg.bonus}</Text>}
            </View>
            <View style={s.cardRight}>
              <Text style={s.pkgLabel}>{pkg.label}</Text>
              {loading === pkg.id
                ? <ActivityIndicator color="#000" size="small" />
                : <View style={s.priceBtn}><Text style={s.priceText}>{pkg.price}</Text></View>
              }
            </View>
          </TouchableOpacity>
        ))}

        {/* Gift cost guide */}
        <View style={s.giftGuide}>
          <Text style={s.guideTitle}>What can you send?</Text>
          {GIFT_PREVIEW.map((g) => (
            <View key={g.name} style={s.guideRow}>
              <Text style={s.guideEmoji}>{g.emoji}</Text>
              <Text style={s.guideName}>{g.name}</Text>
              <Text style={s.guideCost}>{g.cost} Spota</Text>
            </View>
          ))}
        </View>

        <Text style={s.disclaimer}>
          Spota is virtual currency with no cash value. All sales are final.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle:  { fontSize: 17, fontWeight: '700', color: C.white },
  balance:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.yellowDim, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.yellow },
  balanceNum:   { fontSize: 14, fontWeight: '800', color: C.yellow },
  balanceLabel: { fontSize: 14 },
  content:      { padding: 20, gap: 14 },
  intro:        { fontSize: 14, color: C.sub, lineHeight: 20, marginBottom: 6 },

  card:         { backgroundColor: C.surface, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: C.border },
  cardPopular:  { borderColor: C.yellow, backgroundColor: C.yellowDim },
  popularBadge: { position: 'absolute', top: -11, alignSelf: 'center', backgroundColor: C.yellow, paddingHorizontal: 12, paddingVertical: 3, borderRadius: 20 },
  popularText:  { fontSize: 9, fontWeight: '900', color: '#000', letterSpacing: 1 },
  cardLeft:     { gap: 2 },
  spoTaAmt:     { fontSize: 30, fontWeight: '900', color: C.yellow },
  spoTaLabel:   { fontSize: 12, color: C.sub },
  bonus:        { fontSize: 11, color: C.purple, fontWeight: '700', marginTop: 2 },
  cardRight:    { alignItems: 'flex-end', gap: 8 },
  pkgLabel:     { fontSize: 13, color: C.sub },
  priceBtn:     { backgroundColor: C.yellow, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  priceText:    { color: '#000', fontWeight: '800', fontSize: 14 },

  giftGuide:    { backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, gap: 10, marginTop: 6 },
  guideTitle:   { fontSize: 13, fontWeight: '700', color: C.white, marginBottom: 4 },
  guideRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  guideEmoji:   { fontSize: 20, width: 28 },
  guideName:    { flex: 1, fontSize: 13, color: C.sub },
  guideCost:    { fontSize: 13, color: C.yellow, fontWeight: '700' },

  disclaimer:   { fontSize: 11, color: C.sub, textAlign: 'center', lineHeight: 16, marginTop: 8 },
});
