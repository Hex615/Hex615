import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import AvatarPicker from '../../components/AvatarPicker';
import { C } from '../../theme';

const INTERESTS = [
  'Music','Gaming','Sports','Art','Tech','Fashion',
  'Food','Travel','Fitness','Movies','Books','Comedy',
  'Politics','Anime','Dance','Spirituality',
];

export default function OnboardingScreen() {
  const [step, setStep]         = useState(0);
  const [avatarUri, setAvatar]  = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [bio, setBio]           = useState('');
  const [age, setAge]           = useState('');
  const [interests, setInterests] = useState([]);
  const [loading, setLoading]   = useState(false);
  const updateUser = useAuthStore((s) => s.updateUser);

  const toggleInterest = (tag) =>
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag)
        : prev.length < 8 ? [...prev, tag] : prev
    );

  const handleFinish = async () => {
    if (!username.trim()) return Alert.alert('', 'Choose a username to continue');
    const ageNum = parseInt(age);
    if (age && (isNaN(ageNum) || ageNum < 18)) return Alert.alert('', 'You must be 18+ to use Chatsplat');
    setLoading(true);
    try {
      const res = await api.put('/users/me', {
        username: username.trim().toLowerCase().replace(/\s/g, '_'),
        bio: bio.trim() || null,
        age: age ? ageNum : null,
        interests,
        avatar_url: avatarUri,
      });
      updateUser(res.data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  const STEPS = ['Photo', 'Profile', 'Vibes'];
  const canNext1 = username.trim().length >= 3;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Step indicators */}
      <View style={s.steps}>
        {STEPS.map((label, i) => (
          <View key={label} style={s.stepWrap}>
            <View style={[s.dot, i <= step && s.dotActive]}>
              <Text style={[s.dotText, i <= step && s.dotTextActive]}>{i + 1}</Text>
            </View>
            <Text style={[s.stepLabel, i === step && s.stepLabelActive]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Step 0 — Avatar */}
      {step === 0 && (
        <ScrollView contentContainerStyle={s.center}>
          <Text style={s.heading}>Choose your photo</Text>
          <Text style={s.sub}>Pick something that shows your vibe</Text>

          <TouchableOpacity onPress={() => setPickerOpen(true)} style={s.avatarWrap}>
            {avatarUri
              ? <Image source={{ uri: avatarUri }} style={s.avatar} />
              : <View style={s.avatarEmpty}>
                  <Ionicons name="camera" size={36} color={C.purple} />
                  <Text style={s.avatarEmptyText}>Tap to add photo</Text>
                </View>
            }
            <View style={s.editBadge}><Ionicons name="add" size={16} color="#fff" /></View>
          </TouchableOpacity>

          <TouchableOpacity style={s.primaryBtn} onPress={() => setStep(1)}>
            <Text style={s.primaryBtnText}>{avatarUri ? 'Looks good →' : 'Skip for now'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Step 1 — Username & Bio */}
      {step === 1 && (
        <ScrollView contentContainerStyle={s.center}>
          <Text style={s.heading}>What's your name?</Text>

          <View style={s.field}>
            <Text style={s.label}>USERNAME</Text>
            <View style={s.inputRow}>
              <Text style={s.at}>@</Text>
              <TextInput
                style={s.input}
                placeholder="coolname"
                placeholderTextColor={C.sub}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                maxLength={30}
              />
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>BIO</Text>
            <TextInput
              style={[s.input, s.bioInput]}
              placeholder="Tell people who you are..."
              placeholderTextColor={C.sub}
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={160}
            />
            <Text style={s.charCount}>{bio.length}/160</Text>
          </View>

          <View style={s.field}>
            <Text style={s.label}>AGE (must be 18+)</Text>
            <TextInput
              style={s.input}
              placeholder="18"
              placeholderTextColor={C.sub}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>

          <TouchableOpacity style={[s.primaryBtn, !canNext1 && s.btnDim]} onPress={() => canNext1 && setStep(2)} disabled={!canNext1}>
            <Text style={s.primaryBtnText}>Next →</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Step 2 — Interests */}
      {step === 2 && (
        <View style={s.flex1}>
          <Text style={[s.heading, { paddingHorizontal: 24 }]}>What are you into?</Text>
          <Text style={[s.sub, { paddingHorizontal: 24, marginBottom: 20 }]}>Pick up to 8 — {interests.length}/8</Text>

          <ScrollView contentContainerStyle={s.tagsWrap}>
            {INTERESTS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[s.tag, interests.includes(tag) && s.tagOn]}
                onPress={() => toggleInterest(tag)}
              >
                <Text style={[s.tagText, interests.includes(tag) && s.tagTextOn]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={s.finishWrap}>
            <TouchableOpacity
              style={[s.primaryBtn, loading && s.btnDim]}
              onPress={handleFinish}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={s.primaryBtnText}>Let's go! ⚡</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      <AvatarPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(uri) => { setAvatar(uri); setPickerOpen(false); }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  flex1:          { flex: 1 },
  steps:          { flexDirection: 'row', justifyContent: 'center', gap: 24, paddingVertical: 16 },
  stepWrap:       { alignItems: 'center', gap: 4 },
  dot:            { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  dotActive:      { backgroundColor: C.purple, borderColor: C.purple },
  dotText:        { fontSize: 12, color: C.sub, fontWeight: '700' },
  dotTextActive:  { color: '#fff' },
  stepLabel:      { fontSize: 10, color: C.sub },
  stepLabelActive:{ color: C.purple, fontWeight: '700' },

  center:         { flexGrow: 1, alignItems: 'center', padding: 24, paddingTop: 32 },
  heading:        { fontSize: 26, fontWeight: '800', color: C.white, marginBottom: 8 },
  sub:            { fontSize: 14, color: C.sub, marginBottom: 36 },

  avatarWrap:     { position: 'relative', marginBottom: 32 },
  avatar:         { width: 130, height: 130, borderRadius: 65, borderWidth: 2, borderColor: C.purple },
  avatarEmpty:    { width: 130, height: 130, borderRadius: 65, backgroundColor: C.purpleDim, borderWidth: 2, borderStyle: 'dashed', borderColor: C.purple, justifyContent: 'center', alignItems: 'center' },
  avatarEmptyText:{ color: C.purple, fontSize: 11, marginTop: 6 },
  editBadge:      { position: 'absolute', bottom: 4, right: 4, width: 30, height: 30, borderRadius: 15, backgroundColor: C.purple, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C.bg },

  field:    { width: '100%', marginBottom: 16 },
  label:    { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1, marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12 },
  at:       { fontSize: 16, color: C.sub, marginRight: 4 },
  input:    { flex: 1, fontSize: 15, paddingVertical: 13, color: C.white, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14 },
  bioInput: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },
  charCount:{ fontSize: 11, color: C.sub, textAlign: 'right', marginTop: 4 },

  primaryBtn:     { backgroundColor: C.yellow, paddingVertical: 16, paddingHorizontal: 48, borderRadius: 30, marginTop: 16 },
  btnDim:         { opacity: 0.4 },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },

  tagsWrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 24, paddingBottom: 24 },
  tag:        { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  tagOn:      { backgroundColor: C.purple, borderColor: C.purple },
  tagText:    { fontSize: 14, color: C.sub, fontWeight: '500' },
  tagTextOn:  { color: '#fff', fontWeight: '700' },
  finishWrap: { padding: 20, paddingBottom: 32 },
});
