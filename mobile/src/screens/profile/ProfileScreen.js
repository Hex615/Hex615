import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import AvatarPicker from '../../components/AvatarPicker';

export default function ProfileScreen({ navigation }) {
  const { user, updateUser, logout } = useAuthStore();
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);

  useFocusEffect(useCallback(() => {
    if (user?.id) fetchStats();
  }, [user?.id]));

  const fetchStats = async () => {
    try {
      const res = await api.get(`/users/${user.id}`);
      setStats({ followers: res.data.followers_count, following: res.data.following_count });
    } catch {}
  };

  const handleAvatarSelect = async (uri) => {
    setUpdatingAvatar(true);
    try {
      // In production: upload to Cloudinary, get URL back
      // For now we save the URI directly (works locally/on-device)
      const res = await api.put('/users/me', { avatar_url: uri });
      updateUser({ avatar_url: res.data.avatar_url });
    } catch (err) {
      Alert.alert('', 'Failed to update avatar');
    } finally {
      setUpdatingAvatar(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
              <Ionicons name="settings-outline" size={24} color="#222" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Avatar + Info */}
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={() => setAvatarPickerOpen(true)} style={styles.avatarWrap}>
            {updatingAvatar ? (
              <View style={styles.avatar}>
                <ActivityIndicator color="#4FC3F7" />
              </View>
            ) : user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarLetter}>{(user.username || '?')[0].toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={styles.username}>@{user.username || 'setup required'}</Text>
          {user.bio && <Text style={styles.bio}>{user.bio}</Text>}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{stats.followers}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{stats.following}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{user.coins || 0}</Text>
              <Text style={styles.statLabel}>Coins 🪙</Text>
            </View>
          </View>

          {/* Interests */}
          {user.interests?.length > 0 && (
            <View style={styles.interestRow}>
              {user.interests.map((tag) => (
                <View key={tag} style={styles.interestTag}>
                  <Text style={styles.interestText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Badges */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Badges</Text>
          <View style={styles.badgeRow}>
            {user.is_verified && <View style={styles.badge}><Text>✅ Verified</Text></View>}
            {user.is_premium && <View style={[styles.badge, styles.badgePremium]}><Text style={{ color: '#fff' }}>👑 Premium</Text></View>}
            <View style={styles.badge}><Text>🎙️ Host</Text></View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('EditProfile')}>
            <Ionicons name="person-outline" size={20} color="#4FC3F7" />
            <Text style={styles.menuItemText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={16} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Coins')}>
            <Ionicons name="wallet-outline" size={20} color="#4FC3F7" />
            <Text style={styles.menuItemText}>Buy Coins</Text>
            <Ionicons name="chevron-forward" size={16} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#FF4757" />
            <Text style={[styles.menuItemText, { color: '#FF4757' }]}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <AvatarPicker
        visible={avatarPickerOpen}
        onClose={() => setAvatarPickerOpen(false)}
        onSelect={(uri) => {
          setAvatarPickerOpen(false);
          handleAvatarSelect(uri);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '800', color: '#111' },
  headerActions: { flexDirection: 'row', gap: 16 },

  profileSection: { backgroundColor: '#fff', alignItems: 'center', padding: 24, marginBottom: 12 },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  avatarFallback: { backgroundColor: '#4FC3F7' },
  avatarLetter: { fontSize: 36, color: '#fff', fontWeight: '700' },
  editBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#4FC3F7', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  username: { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 4 },
  bio: { fontSize: 14, color: '#777', textAlign: 'center', marginBottom: 16, lineHeight: 20 },

  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', color: '#111' },
  statLabel: { fontSize: 12, color: '#aaa', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: '#eee' },

  interestRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  interestTag: { backgroundColor: '#f0faff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#d0eefb' },
  interestText: { color: '#4FC3F7', fontSize: 12, fontWeight: '600' },

  section: { backgroundColor: '#fff', marginBottom: 12, paddingHorizontal: 20, paddingVertical: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  badgeRow: { flexDirection: 'row', gap: 10 },
  badge: { backgroundColor: '#f5f5f5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgePremium: { backgroundColor: '#FFD700' },

  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  menuItemText: { flex: 1, fontSize: 15, color: '#333', fontWeight: '500' },
});
