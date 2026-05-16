import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, FlatList,
  Image, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

// Aesthetic image categories from Picsum (no API key needed)
// Each generates a different beautiful random photo
const AESTHETIC_THEMES = [
  { label: 'Nature', seed: 10 },
  { label: 'City', seed: 20 },
  { label: 'Abstract', seed: 30 },
  { label: 'Minimal', seed: 40 },
  { label: 'Sunset', seed: 50 },
  { label: 'Forest', seed: 60 },
  { label: 'Ocean', seed: 70 },
  { label: 'Fashion', seed: 80 },
  { label: 'Vintage', seed: 90 },
  { label: 'Dark', seed: 100 },
  { label: 'Pastel', seed: 110 },
  { label: 'Aesthetic', seed: 120 },
];

function getRandomImages(count = 30) {
  return Array.from({ length: count }, (_, i) => ({
    id: `picsum-${i}`,
    uri: `https://picsum.photos/seed/${Math.floor(Math.random() * 999) + 1}/400/400`,
  }));
}

export default function AvatarPicker({ visible, onClose, onSelect }) {
  const [tab, setTab] = useState('random'); // 'random' | 'device'
  const [randomImages, setRandomImages] = useState(() => getRandomImages());
  const [loading, setLoading] = useState(false);
  const [selectedUri, setSelectedUri] = useState(null);

  const refreshRandom = () => setRandomImages(getRandomImages());

  const pickFromDevice = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access in Settings to pick a photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access in Settings.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedUri(result.assets[0].uri);
    }
  };

  const handleConfirm = () => {
    if (selectedUri) {
      onSelect(selectedUri);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Choose Profile Photo</Text>
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={!selectedUri}
            style={[styles.doneBtn, !selectedUri && styles.doneBtnDisabled]}
          >
            <Text style={[styles.doneBtnText, !selectedUri && styles.doneBtnTextDisabled]}>
              Done
            </Text>
          </TouchableOpacity>
        </View>

        {/* Preview */}
        {selectedUri && (
          <View style={styles.previewWrapper}>
            <Image source={{ uri: selectedUri }} style={styles.preview} />
            <TouchableOpacity style={styles.clearPreview} onPress={() => setSelectedUri(null)}>
              <Ionicons name="close-circle" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'random' && styles.tabActive]}
            onPress={() => setTab('random')}
          >
            <Text style={[styles.tabText, tab === 'random' && styles.tabTextActive]}>
              Aesthetic Picks
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'device' && styles.tabActive]}
            onPress={() => setTab('device')}
          >
            <Text style={[styles.tabText, tab === 'device' && styles.tabTextActive]}>
              My Photos
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'random' ? (
          <View style={styles.flex1}>
            <View style={styles.refreshRow}>
              <Text style={styles.hint}>Tap any image to select it</Text>
              <TouchableOpacity onPress={refreshRandom} style={styles.refreshBtn}>
                <Ionicons name="refresh" size={16} color="#4FC3F7" />
                <Text style={styles.refreshText}> Shuffle</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={randomImages}
              numColumns={3}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.grid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => setSelectedUri(item.uri)}
                  style={[
                    styles.gridItem,
                    selectedUri === item.uri && styles.gridItemSelected,
                  ]}
                >
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.gridImage}
                    onError={() => {}}
                  />
                  {selectedUri === item.uri && (
                    <View style={styles.checkOverlay}>
                      <Ionicons name="checkmark-circle" size={28} color="#4FC3F7" />
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        ) : (
          <View style={styles.deviceTab}>
            <View style={styles.deviceOptions}>
              <TouchableOpacity style={styles.deviceOption} onPress={pickFromDevice}>
                <View style={styles.deviceIconBg}>
                  <Ionicons name="images" size={32} color="#4FC3F7" />
                </View>
                <Text style={styles.deviceOptionTitle}>Photo Library</Text>
                <Text style={styles.deviceOptionSub}>Pick from your camera roll</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.deviceOption} onPress={takePhoto}>
                <View style={styles.deviceIconBg}>
                  <Ionicons name="camera" size={32} color="#4FC3F7" />
                </View>
                <Text style={styles.deviceOptionTitle}>Take a Photo</Text>
                <Text style={styles.deviceOptionSub}>Use your camera now</Text>
              </TouchableOpacity>
            </View>

            {selectedUri && tab === 'device' && (
              <View style={styles.devicePreviewRow}>
                <Image source={{ uri: selectedUri }} style={styles.devicePreviewImg} />
                <View style={styles.devicePreviewInfo}>
                  <Text style={styles.devicePreviewLabel}>Selected photo</Text>
                  <TouchableOpacity onPress={handleConfirm} style={styles.usePhotoBtn}>
                    <Text style={styles.usePhotoBtnText}>Use this photo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: { fontSize: 17, fontWeight: '600', color: '#111' },
  doneBtn: { backgroundColor: '#4FC3F7', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  doneBtnDisabled: { backgroundColor: '#e0e0e0' },
  doneBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  doneBtnTextDisabled: { color: '#aaa' },

  previewWrapper: { alignItems: 'center', paddingVertical: 12, position: 'relative' },
  preview: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#4FC3F7' },
  clearPreview: {
    position: 'absolute', top: 8, right: '35%',
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12,
  },

  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 4 },
  tab: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#4FC3F7' },
  tabText: { fontSize: 14, color: '#999', fontWeight: '500' },
  tabTextActive: { color: '#4FC3F7', fontWeight: '700' },

  flex1: { flex: 1 },
  refreshRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8,
  },
  hint: { fontSize: 12, color: '#999' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center' },
  refreshText: { color: '#4FC3F7', fontSize: 13, fontWeight: '600' },

  grid: { paddingHorizontal: 4 },
  gridItem: { flex: 1 / 3, margin: 2, borderRadius: 8, overflow: 'hidden', aspectRatio: 1 },
  gridItemSelected: { borderWidth: 3, borderColor: '#4FC3F7' },
  gridImage: { width: '100%', height: '100%' },
  checkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  deviceTab: { flex: 1, padding: 20 },
  deviceOptions: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  deviceOption: {
    flex: 1, backgroundColor: '#f8f9fb', borderRadius: 16,
    padding: 20, alignItems: 'center',
    borderWidth: 1, borderColor: '#eee',
  },
  deviceIconBg: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#e8f6fd', justifyContent: 'center', alignItems: 'center',
    marginBottom: 10,
  },
  deviceOptionTitle: { fontSize: 14, fontWeight: '700', color: '#222', marginBottom: 4 },
  deviceOptionSub: { fontSize: 12, color: '#888', textAlign: 'center' },

  devicePreviewRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8f9fb', borderRadius: 16, padding: 16, gap: 16,
  },
  devicePreviewImg: { width: 80, height: 80, borderRadius: 40 },
  devicePreviewInfo: { flex: 1 },
  devicePreviewLabel: { fontSize: 13, color: '#666', marginBottom: 10 },
  usePhotoBtn: {
    backgroundColor: '#4FC3F7', paddingVertical: 10,
    borderRadius: 24, alignItems: 'center',
  },
  usePhotoBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
