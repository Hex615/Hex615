import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Switch, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import { C } from '../../theme';

const MODES = [
  { id: 'audio', label: 'Audio Only', icon: 'mic',       desc: 'Voice only — classic Splat Room' },
  { id: 'video', label: 'Video Only', icon: 'videocam',  desc: 'Cameras on, mics optional' },
  { id: 'both',  label: 'Audio + Video', icon: 'radio',  desc: 'Full experience — cam & mic' },
];

const THEMES = [
  { id: 1,  name: 'Late Night Vibes',  emoji: '🌙' },
  { id: 2,  name: 'Chill Zone',        emoji: '🛋️' },
  { id: 3,  name: 'Hype House',        emoji: '🔥' },
  { id: 4,  name: 'Study Hall',        emoji: '📚' },
  { id: 5,  name: 'Game Room',         emoji: '🎮' },
  { id: 6,  name: 'Music Studio',      emoji: '🎵' },
  { id: 7,  name: 'Comedy Club',       emoji: '😂' },
  { id: 8,  name: 'Debate Stage',      emoji: '🎙️' },
  { id: 9,  name: 'Fashion Week',      emoji: '👗' },
  { id: 10, name: 'Fitness Room',      emoji: '💪' },
  { id: 11, name: 'Tech Talk',         emoji: '💻' },
  { id: 12, name: 'Story Time',        emoji: '📖' },
  { id: 13, name: 'Karaoke Night',     emoji: '🎤' },
  { id: 14, name: 'Roast Session',     emoji: '🔥' },
  { id: 15, name: 'Therapy Corner',    emoji: '🧠' },
];

export default function CreateRoomScreen({ navigation }) {
  const [title,    setTitle]    = useState('');
  const [mode,     setMode]     = useState('audio');
  const [themeId,  setThemeId]  = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [pin,      setPin]      = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return Alert.alert('', 'Give your room a title');
    if (isLocked && pin.length !== 4) return Alert.alert('', 'PIN must be exactly 4 digits');
    setLoading(true);
    try {
      const res = await api.post('/rooms', {
        title: title.trim(),
        mode,
        theme_id: themeId,
        is_locked: isLocked,
        pin: isLocked ? pin : undefined,
      });
      navigation.replace('SplatRoom', { room: res.data });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color={C.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>New Splat Room</Text>
        <TouchableOpacity
          style={[s.createBtn, (!title.trim() || loading) && s.createBtnDim]}
          onPress={handleCreate}
          disabled={!title.trim() || loading}
        >
          {loading
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={s.createBtnText}>Go Live</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <View style={s.section}>
          <Text style={s.label}>ROOM TITLE</Text>
          <TextInput
            style={s.titleInput}
            placeholder="What are you talking about?"
            placeholderTextColor={C.sub}
            value={title}
            onChangeText={setTitle}
            maxLength={60}
          />
          <Text style={s.charCount}>{title.length}/60</Text>
        </View>

        {/* Mode */}
        <View style={s.section}>
          <Text style={s.label}>ROOM MODE</Text>
          {MODES.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[s.modeRow, mode === m.id && s.modeRowOn]}
              onPress={() => setMode(m.id)}
            >
              <View style={[s.modeIcon, mode === m.id && { backgroundColor: C.purple }]}>
                <Ionicons name={m.icon} size={18} color={mode === m.id ? '#fff' : C.sub} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.modeLabel, mode === m.id && { color: C.white }]}>{m.label}</Text>
                <Text style={s.modeDesc}>{m.desc}</Text>
              </View>
              {mode === m.id && <Ionicons name="checkmark-circle" size={20} color={C.purple} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Theme */}
        <View style={s.section}>
          <Text style={s.label}>ROOM THEME  <Text style={s.labelSub}>(optional)</Text></Text>
          <View style={s.themesGrid}>
            {THEMES.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[s.themeChip, themeId === t.id && s.themeChipOn]}
                onPress={() => setThemeId(themeId === t.id ? null : t.id)}
              >
                <Text style={s.themeEmoji}>{t.emoji}</Text>
                <Text style={[s.themeName, themeId === t.id && { color: C.white }]} numberOfLines={1}>{t.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Lock */}
        <View style={s.section}>
          <View style={s.lockRow}>
            <View>
              <Text style={s.lockLabel}>Private Room</Text>
              <Text style={s.lockSub}>Require a PIN to join</Text>
            </View>
            <Switch
              value={isLocked}
              onValueChange={setIsLocked}
              trackColor={{ false: C.border, true: C.purple }}
              thumbColor={isLocked ? C.yellow : C.sub}
            />
          </View>
          {isLocked && (
            <TextInput
              style={s.pinInput}
              placeholder="4-digit PIN"
              placeholderTextColor={C.sub}
              value={pin}
              onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: C.bg },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle:   { fontSize: 17, fontWeight: '700', color: C.white },
  createBtn:     { backgroundColor: C.yellow, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  createBtnDim:  { opacity: 0.4 },
  createBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
  content:       { padding: 20, gap: 24 },
  section:       { gap: 10 },
  label:         { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1 },
  labelSub:      { fontWeight: '400', textTransform: 'none' },
  titleInput:    { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 14, color: C.white, fontSize: 16 },
  charCount:     { fontSize: 11, color: C.sub, textAlign: 'right' },
  modeRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  modeRowOn:     { borderColor: C.purple, backgroundColor: C.purpleDim },
  modeIcon:      { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface2, justifyContent: 'center', alignItems: 'center' },
  modeLabel:     { fontSize: 15, fontWeight: '700', color: C.sub, marginBottom: 2 },
  modeDesc:      { fontSize: 12, color: C.sub },
  themesGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  themeChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  themeChipOn:   { backgroundColor: C.purple, borderColor: C.purple },
  themeEmoji:    { fontSize: 14 },
  themeName:     { fontSize: 12, color: C.sub, fontWeight: '500', maxWidth: 100 },
  lockRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  lockLabel:     { fontSize: 15, fontWeight: '600', color: C.white },
  lockSub:       { fontSize: 12, color: C.sub, marginTop: 2 },
  pinInput:      { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.purple, paddingHorizontal: 16, paddingVertical: 12, color: C.white, fontSize: 20, textAlign: 'center', letterSpacing: 8 },
});
