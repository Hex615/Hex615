import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Image, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import AvatarPicker from '../../components/AvatarPicker';

const INTERESTS = [
  'Music', 'Gaming', 'Sports', 'Art', 'Tech', 'Fashion',
  'Food', 'Travel', 'Fitness', 'Movies', 'Books', 'Comedy',
  'Politics', 'Anime', 'Dance', 'Spirituality',
];

export default function EditProfileScreen({ navigation }) {
  const { user, updateUser } = useAuthStore();
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [interests, setInterests] = useState(user?.interests || []);
  const [avatarUri, setAvatarUri] = useState(user?.avatar_url || null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleInterest = (tag) =>
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 8 ? [...prev, tag] : prev
    );

  const handleSave = async () => {
    if (!username.trim()) return Alert.alert('', 'Username is required');
    setLoading(true);
    try {
      const res = await api.put('/users/me', {
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
        age: age ? parseInt(age) : null,
        interests,
        avatar_url: avatarUri,
      });
      updateUser(res.data);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#4FC3F7" />
            : <Text style={styles.saveBtn}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar Picker */}
        <TouchableOpacity style={styles.avatarSection} onPress={() => setAvatarPickerOpen(true)}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarLetter}>{(username || '?')[0].toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.changePhotoRow}>
            <Ionicons name="camera" size={16} color="#4FC3F7" />
            <Text style={styles.changePhotoText}>Change photo</Text>
          </View>
          <Text style={styles.changePhotoHint}>Pick from device or choose an aesthetic pic</Text>
        </TouchableOpacity>

        {/* Fields */}
        <View style={styles.field}>
          <Text style={styles.label}>Username</Text>
          <View style={styles.inputRow}>
            <Text style={styles.atSign}>@</Text>
            <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" maxLength={30} />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={160}
            placeholder="Tell people who you are..."
          />
          <Text style={styles.charCount}>{bio.length}/160</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Age</Text>
          <TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={2} placeholder="18" />
        </View>

        {/* Interests */}
        <View style={styles.field}>
          <Text style={styles.label}>Interests (up to 8)</Text>
          <View style={styles.tagsGrid}>
            {INTERESTS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[styles.tag, interests.includes(tag) && styles.tagSelected]}
                onPress={() => toggleInterest(tag)}
              >
                <Text style={[styles.tagText, interests.includes(tag) && styles.tagTextSelected]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <AvatarPicker
        visible={avatarPickerOpen}
        onClose={() => setAvatarPickerOpen(false)}
        onSelect={(uri) => {
          setAvatarUri(uri);
          setAvatarPickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 17, fontWeight: '700', color: '#111' },
  saveBtn: { color: '#4FC3F7', fontSize: 16, fontWeight: '700' },
  content: { padding: 20, gap: 20 },

  avatarSection: { alignItems: 'center', paddingVertical: 8 },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 10 },
  avatarFallback: { backgroundColor: '#4FC3F7', justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontSize: 36, color: '#fff', fontWeight: '700' },
  changePhotoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  changePhotoText: { color: '#4FC3F7', fontWeight: '700', fontSize: 15 },
  changePhotoHint: { fontSize: 12, color: '#aaa' },

  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 12 },
  atSign: { fontSize: 16, color: '#aaa', marginRight: 4 },
  input: { flex: 1, fontSize: 15, paddingVertical: 12, color: '#222', borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 14 },
  bioInput: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },
  charCount: { fontSize: 11, color: '#bbb', textAlign: 'right' },

  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f4f4f4', borderWidth: 1.5, borderColor: '#eee' },
  tagSelected: { backgroundColor: '#4FC3F7', borderColor: '#4FC3F7' },
  tagText: { fontSize: 13, color: '#555', fontWeight: '500' },
  tagTextSelected: { color: '#fff', fontWeight: '700' },
});
