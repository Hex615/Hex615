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
import { C, getVoltageRank } from '../../theme';

export default function ProfileScreen({ navigation }) {
  const { user, updateUser, logout } = useAuthStore();
  const [stats, setStats]           = useState({ followers: 0, following: 0 });
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [updatingAvatar, setUpdating] = useState(false);

  useFocusEffect(useCallback(() => { if (user?.id) fetchStats(); }, [user?.id]));

  const fetchStats = async () => {
    try {
      const res = await api.get(`/users/${user.id}`);
      setStats({ followers: res.data.followers_count, following: res.data.following_count });
    } catch {}
  };

  const handleAvatarSelect = async (uri) => {
    setUpdating(true);
    try {
      const res = await api.put('/users/me', { avatar_url: uri });
      updateUser({ avatar_url: res.data.avatar_url });
    } catch {
      Alert.alert('', 'Failed to update avatar');
    } finally {
      setUpdating(false);
    }
  };

  if (!user) return null;

  const rank = getVoltageRank(user.lifetime_voltage || 0);
  const nextRankIdx = Math.min(9, rank.idx + 1); // cap at LOUD

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Profile</Text>
          <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
            <Ionicons name="settings-outline" size={22} color={C.white} />
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={s.profileCard}>
          <TouchableOpacity onPress={() => setAvatarOpen(true)} style={s.avatarWrap}>
            {updatingAvatar ? (
              <View style={[s.avatar, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator color={C.purple} />
              </View>
            ) : user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarFb]}>
                <Text style={s.avatarLetter}>{(user.username || '?')[0].toUpperCase()}</Text>
              </View>
            )}
            <View style={s.camBadge}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={s.username}>@{user.username || 'setup required'}</Text>
          {user.bio && <Text style={s.bio}>{user.bio}</Text>}

          {/* Voltage rank */}
          <View style={[s.rankBanner, { borderColor: rank.color }]}>
            <Text style={[s.rankTitle, { color: rank.color }]}>⚡ {rank.title}</Text>
            <Text style={s.voltageNum}>{(user.lifetime_voltage || 0).toLocaleString()} V</Text>
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statNum}>{stats.followers}</Text>
              <Text style={s.statLabel}>Followers</Text>
            </View>
            <View style={s.divider} />
            <View style={s.stat}>
              <Text style={s.statNum}>{stats.following}</Text>
              <Text style={s.statLabel}>Following</Text>
            </View>
            <View style={s.divider} />
            <View style={s.stat}>
              <Text style={[s.statNum, { color: C.yellow }]}>{user.spota_balance || 0}</Text>
              <Text style={s.statLabel}>Spota ⚡</Text>
            </View>
          </View>

          {user.interests?.length > 0 && (
            <View style={s.tagRow}>
              {user.interests.map((t) => (
                <View key={t} style={s.tag}>
                  <Text style={s.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Menu */}
        <View style={s.menu}>
          {[
            { icon: 'person-outline', label: 'Edit Profile',  onPress: () => navigation.navigate('EditProfile'), color: C.purple },
            { icon: 'flash-outline',  label: 'Buy Spota',     onPress: () => navigation.navigate('BuySpota'),    color: C.yellow },
            { icon: 'log-out-outline',label: 'Log out',       onPress: () => Alert.alert('Log out', 'Are you sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: logout }]), color: C.live },
          ].map(({ icon, label, onPress, color }, i, arr) => (
            <TouchableOpacity key={label} style={[s.menuItem, i === arr.length - 1 && { borderBottomWidth: 0 }]} onPress={onPress}>
              <Ionicons name={icon} size={20} color={color} />
              <Text style={[s.menuLabel, { color: i === arr.length - 1 ? C.live : C.white }]}>{label}</Text>
              {i < arr.length - 1 && <Ionicons name="chevron-forward" size={16} color={C.sub} />}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <AvatarPicker
        visible={avatarOpen}
        onClose={() => setAvatarOpen(false)}
        onSelect={(uri) => { setAvatarOpen(false); handleAvatarSelect(uri); }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  title:        { fontSize: 22, fontWeight: '800', color: C.white },
  profileCard:  { backgroundColor: C.surface, alignItems: 'center', padding: 24, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  avatarWrap:   { position: 'relative', marginBottom: 12 },
  avatar:       { width: 96, height: 96, borderRadius: 48, backgroundColor: C.surface2 },
  avatarFb:     { backgroundColor: C.purple, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontSize: 34, color: '#fff', fontWeight: '700' },
  camBadge:     { position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: C.purple, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C.bg },
  username:     { fontSize: 20, fontWeight: '800', color: C.white, marginBottom: 4 },
  bio:          { fontSize: 13, color: C.sub, textAlign: 'center', marginBottom: 14, lineHeight: 19 },
  rankBanner:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 16, width: '100%' },
  rankTitle:    { fontSize: 15, fontWeight: '800' },
  voltageNum:   { fontSize: 13, color: C.sub },
  statsRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  stat:         { flex: 1, alignItems: 'center' },
  statNum:      { fontSize: 20, fontWeight: '800', color: C.white },
  statLabel:    { fontSize: 11, color: C.sub, marginTop: 2 },
  divider:      { width: 1, height: 28, backgroundColor: C.border },
  tagRow:       { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 4 },
  tag:          { backgroundColor: C.purpleDim, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: C.purple },
  tagText:      { color: C.purple, fontSize: 12, fontWeight: '600' },
  menu:         { backgroundColor: C.surface, paddingHorizontal: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  menuItem:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  menuLabel:    { flex: 1, fontSize: 15, fontWeight: '500' },
});
