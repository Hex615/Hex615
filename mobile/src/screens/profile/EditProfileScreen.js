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
import { C } from '../../theme';

const INTERESTS = [
  'Music','Gaming','Sports','Art','Tech','Fashion',
  'Food','Travel','Fitness','Movies','Books','Comedy',
  'Politics','Anime','Dance','Spirituality',
];

export default function EditProfileScreen({ navigation }) {
  const { user, updateUser } = useAuthStore();
  const [username,  setUsername]  = useState(user?.username || '');
  const [bio,       setBio]       = useState(user?.bio || '');
  const [age,       setAge]       = useState(user?.age ? String(user.age) : '');
  const [interests, setInterests] = useState(user?.interests || []);
  const [avatarUri, setAvatarUri] = useState(user?.avatar_url || null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading,   setLoading]   = useState(false);

  const toggleInterest = (tag) =>
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag)
        : prev.length < 8 ? [...prev, tag] : prev
    );

  const handleSave = async () => {
    if (!username.trim()) return Alert.alert('', 'Username is required');
    setLoading(true);
    try {
      const res = await api.put('/users/me', {
        username: username.trim().toLowerCase(),
        bio: bio.trim() || null,
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
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={s.title}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading
            ? <ActivityIndicator color={C.yellow} size="small" />
            : <Text style={s.saveBtn}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <TouchableOpacity style={s.avatarSection} onPress={() => setPickerOpen(true)}>
          {avatarUri
            ? <Image source={{ uri: avatarUri }} style={s.avatar} />
            : <View style={[s.avatar, s.avatarFb]}>
                <Text style={s.avatarLetter}>{(username || '?')[0].toUpperCase()}</Text>
              </View>
          }
          <View style={s.changeRow}>
            <Ionicons name="camera" size={15} color={C.purple} />
            <Text style={s.changeText}>Change photo</Text>
          </View>
        </TouchableOpacity>

        {/* Username */}
        <View style={s.field}>
          <Text style={s.label}>USERNAME</Text>
          <View style={s.inputRow}>
            <Text style={s.at}>@</Text>
            <TextInput
              style={s.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              maxLength={30}
              placeholderTextColor={C.sub}
            />
          </View>
        </View>

        {/* Bio */}
        <View style={s.field}>
          <Text style={s.label}>BIO</Text>
          <TextInput
            style={[s.input, s.bioInput]}
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={160}
            placeholder="Tell people who you are..."
            placeholderTextColor={C.sub}
          />
          <Text style={s.charCount}>{bio.length}/160</Text>
        </View>

        {/* Age */}
        <View style={s.field}>
          <Text style={s.label}>AGE</Text>
          <TextInput
            style={s.input}
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="18"
            placeholderTextColor={C.sub}
          />
        </View>

        {/* Interests */}
        <View style={s.field}>
          <Text style={s.label}>INTERESTS  {interests.length}/8</Text>
          <View style={s.tagsGrid}>
            {INTERESTS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[s.tag, interests.includes(tag) && s.tagOn]}
                onPress={() => toggleInterest(tag)}
              >
                <Text style={[s.tagText, interests.includes(tag) && s.tagTextOn]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <AvatarPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(uri) => { setAvatarUri(uri); setPickerOpen(false); }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  title:        { fontSize: 17, fontWeight: '700', color: C.white },
  saveBtn:      { color: C.yellow, fontSize: 16, fontWeight: '700' },
  content:      { padding: 20, gap: 20 },
  avatarSection:{ alignItems: 'center', paddingVertical: 8 },
  avatar:       { width: 96, height: 96, borderRadius: 48, marginBottom: 10 },
  avatarFb:     { backgroundColor: C.purple, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontSize: 34, color: '#fff', fontWeight: '700' },
  changeRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  changeText:   { color: C.purple, fontWeight: '700', fontSize: 14 },
  field:        { gap: 8 },
  label:        { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1 },
  inputRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12 },
  at:           { fontSize: 16, color: C.sub, marginRight: 4 },
  input:        { flex: 1, fontSize: 15, paddingVertical: 12, color: C.white, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14 },
  bioInput:     { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },
  charCount:    { fontSize: 11, color: C.sub, textAlign: 'right' },
  tagsGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  tagOn:        { backgroundColor: C.purple, borderColor: C.purple },
  tagText:      { fontSize: 13, color: C.sub, fontWeight: '500' },
  tagTextOn:    { color: '#fff', fontWeight: '700' },
});
