import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import AvatarPicker from '../../components/AvatarPicker';

const INTERESTS = [
  'Music', 'Gaming', 'Sports', 'Art', 'Tech', 'Fashion',
  'Food', 'Travel', 'Fitness', 'Movies', 'Books', 'Comedy',
  'Politics', 'Anime', 'Dance', 'Spirituality',
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0); // 0=avatar, 1=username/bio, 2=interests
  const [avatarUri, setAvatarUri] = useState(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [age, setAge] = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const updateUser = useAuthStore((s) => s.updateUser);

  const toggleInterest = (tag) => {
    setSelected((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 8 ? [...prev, tag] : prev
    );
  };

  const uploadAvatar = async (localUri) => {
    // Upload to backend as multipart or send URL directly
    // For demo: just return the local URI as the avatar_url
    // In production: upload to Cloudinary, get back a URL
    return localUri;
  };

  const handleFinish = async () => {
    if (!username.trim()) return Alert.alert('', 'Please choose a username');
    setLoading(true);
    try {
      let avatar_url = null;
      if (avatarUri) avatar_url = await uploadAvatar(avatarUri);

      const res = await api.put('/users/me', {
        username: username.trim().toLowerCase().replace(/\s/g, '_'),
        bio: bio.trim(),
        age: age ? parseInt(age) : null,
        interests: selected,
        avatar_url,
      });
      updateUser(res.data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Step 0 — Avatar */}
      {step === 0 && (
        <ScrollView contentContainerStyle={styles.center}>
          <Text style={styles.stepTitle}>Choose your profile photo</Text>
          <Text style={styles.stepSub}>Pick something that shows your vibe ✨</Text>

          <TouchableOpacity onPress={() => setAvatarPickerOpen(true)} style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="camera" size={40} color="#4FC3F7" />
                <Text style={styles.avatarPlaceholderText}>Tap to add photo</Text>
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="add" size={18} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={styles.optionRow}>
            <TouchableOpacity style={styles.optionBtn} onPress={() => setAvatarPickerOpen(true)}>
              <Ionicons name="images-outline" size={20} color="#4FC3F7" />
              <Text style={styles.optionBtnText}>Aesthetic Picks</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionBtn} onPress={() => setAvatarPickerOpen(true)}>
              <Ionicons name="phone-portrait-outline" size={20} color="#4FC3F7" />
              <Text style={styles.optionBtnText}>From Device</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(1)}>
            <Text style={styles.nextBtnText}>{avatarUri ? 'Next →' : 'Skip for now'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Step 1 — Username & Bio */}
      {step === 1 && (
        <ScrollView contentContainerStyle={styles.center}>
          <Text style={styles.stepTitle}>What should we call you?</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.atSign}>@</Text>
              <TextInput
                style={styles.input}
                placeholder="coolname"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                maxLength={30}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              style={[styles.input, styles.inputBio]}
              placeholder="Tell people who you are..."
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={160}
            />
            <Text style={styles.charCount}>{bio.length}/160</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Age</Text>
            <TextInput
              style={styles.input}
              placeholder="18"
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>

          <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(2)}>
            <Text style={styles.nextBtnText}>Next →</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Step 2 — Interests */}
      {step === 2 && (
        <View style={styles.flex1}>
          <View style={styles.center}>
            <Text style={styles.stepTitle}>What are you into?</Text>
            <Text style={styles.stepSub}>Pick up to 8 interests</Text>
          </View>

          <View style={styles.tagsGrid}>
            {INTERESTS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[styles.tag, selected.includes(tag) && styles.tagSelected]}
                onPress={() => toggleInterest(tag)}
              >
                <Text style={[styles.tagText, selected.includes(tag) && styles.tagTextSelected]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.nextBtn, styles.finishBtn, loading && { opacity: 0.6 }]}
            onPress={handleFinish}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.nextBtnText}>Let's go! 🎉</Text>}
          </TouchableOpacity>
        </View>
      )}

      <AvatarPicker
        visible={avatarPickerOpen}
        onClose={() => setAvatarPickerOpen(false)}
        onSelect={(uri) => {
          setAvatarUri(uri);
          setAvatarPickerOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  flex1: { flex: 1, padding: 24, paddingTop: 60 },
  center: { flexGrow: 1, alignItems: 'center', padding: 24, paddingTop: 80 },
  stepTitle: { fontSize: 26, fontWeight: '800', color: '#111', textAlign: 'center', marginBottom: 8 },
  stepSub: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 40 },

  avatarWrap: { position: 'relative', marginBottom: 32 },
  avatar: { width: 130, height: 130, borderRadius: 65, borderWidth: 3, borderColor: '#4FC3F7' },
  avatarPlaceholder: {
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: '#f0faff', borderWidth: 2, borderStyle: 'dashed', borderColor: '#4FC3F7',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarPlaceholderText: { color: '#4FC3F7', fontSize: 12, marginTop: 4 },
  avatarBadge: {
    position: 'absolute', bottom: 4, right: 4,
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#4FC3F7',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },

  optionRow: { flexDirection: 'row', gap: 12, marginBottom: 40, width: '100%' },
  optionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 14, borderRadius: 14, backgroundColor: '#f0faff',
    borderWidth: 1, borderColor: '#d0eefb',
  },
  optionBtnText: { color: '#4FC3F7', fontWeight: '600', fontSize: 13 },

  inputGroup: { width: '100%', marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 12 },
  atSign: { fontSize: 16, color: '#aaa', marginRight: 4 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12, color: '#222', borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 14 },
  inputBio: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },
  charCount: { textAlign: 'right', fontSize: 11, color: '#bbb', marginTop: 4 },

  nextBtn: { backgroundColor: '#4FC3F7', paddingVertical: 16, paddingHorizontal: 40, borderRadius: 30, marginTop: 8 },
  finishBtn: { marginHorizontal: 0, borderRadius: 14, width: '100%', alignItems: 'center' },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 },
  tag: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, backgroundColor: '#f4f4f4', borderWidth: 1.5, borderColor: '#eee' },
  tagSelected: { backgroundColor: '#4FC3F7', borderColor: '#4FC3F7' },
  tagText: { fontSize: 14, color: '#555', fontWeight: '500' },
  tagTextSelected: { color: '#fff', fontWeight: '700' },
});
