import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Switch, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

const CATEGORIES = ['Music', 'Discussion', 'Gaming', 'Tech', 'Sports', 'Art', 'Education', 'General'];

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];
const DAYS_AHEAD = 7;

function buildScheduledDate(daysFromNow, hour, minute, ampm) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  let h = parseInt(hour, 10);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  d.setHours(h, parseInt(minute, 10), 0, 0);
  return d;
}

function dayLabel(offset) {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function CreateRoomScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [isScheduled, setIsScheduled] = useState(false);
  const [dayOffset, setDayOffset] = useState(0);
  const [hour, setHour] = useState('07');
  const [minute, setMinute] = useState('00');
  const [ampm, setAmpm] = useState('PM');
  const [loading, setLoading] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return Alert.alert('', 'Room title is required');

    let scheduled_at = null;
    if (isScheduled) {
      const d = buildScheduledDate(dayOffset, hour, minute, ampm);
      if (d <= new Date()) return Alert.alert('', 'Scheduled time must be in the future');
      scheduled_at = d.toISOString();
    }

    setLoading(true);
    try {
      const res = await api.post('/rooms', {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        is_scheduled: isScheduled,
        scheduled_at,
      });
      if (isScheduled) {
        Alert.alert('Scheduled!', 'Your room is on the calendar. Come back to go live when it\'s time.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        navigation.replace('AudioRoom', { room: res.data });
      }
    } catch (err) {
      Alert.alert('', err.response?.data?.error || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Room</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="What's this room about?"
          placeholderTextColor="#aaa"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
        />

        <Text style={styles.label}>Category</Text>
        <TouchableOpacity style={styles.picker} onPress={() => setShowCatModal(true)}>
          <Text style={styles.pickerText}>{category}</Text>
          <Ionicons name="chevron-down" size={18} color="#666" />
        </TouchableOpacity>

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Give listeners a preview..."
          placeholderTextColor="#aaa"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          maxLength={300}
        />

        <View style={styles.scheduleRow}>
          <View style={styles.scheduleRowLeft}>
            <Ionicons name="calendar-outline" size={20} color="#4FC3F7" />
            <Text style={styles.scheduleLabel}>Schedule for later</Text>
          </View>
          <Switch
            value={isScheduled}
            onValueChange={setIsScheduled}
            trackColor={{ false: '#ddd', true: '#4FC3F7' }}
            thumbColor="#fff"
          />
        </View>

        {isScheduled && (
          <View style={styles.schedulePicker}>
            <Text style={styles.subLabel}>Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
              {Array.from({ length: DAYS_AHEAD }, (_, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.dayChip, dayOffset === i && styles.dayChipActive]}
                  onPress={() => setDayOffset(i)}
                >
                  <Text style={[styles.dayChipText, dayOffset === i && styles.dayChipTextActive]}>
                    {dayLabel(i)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.subLabel}>Time</Text>
            <View style={styles.timeRow}>
              <View style={styles.timeGroup}>
                <Text style={styles.timeGroupLabel}>Hour</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {HOURS.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.timeChip, hour === h && styles.timeChipActive]}
                      onPress={() => setHour(h)}
                    >
                      <Text style={[styles.timeChipText, hour === h && styles.timeChipTextActive]}>{h}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.timeGroup}>
                <Text style={styles.timeGroupLabel}>Min</Text>
                <View style={styles.minRow}>
                  {MINUTES.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.timeChip, minute === m && styles.timeChipActive]}
                      onPress={() => setMinute(m)}
                    >
                      <Text style={[styles.timeChipText, minute === m && styles.timeChipTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.timeGroup}>
                <Text style={styles.timeGroupLabel}>AM/PM</Text>
                <View style={styles.ampmRow}>
                  {['AM', 'PM'].map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.timeChip, ampm === p && styles.timeChipActive]}
                      onPress={() => setAmpm(p)}
                    >
                      <Text style={[styles.timeChipText, ampm === p && styles.timeChipTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.previewBox}>
              <Ionicons name="time-outline" size={15} color="#4FC3F7" />
              <Text style={styles.previewText}>
                {buildScheduledDate(dayOffset, hour, minute, ampm).toLocaleString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                  hour: 'numeric', minute: '2-digit',
                })}
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.createBtn, loading && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          <Ionicons name={isScheduled ? 'calendar' : 'mic'} size={20} color="#fff" />
          <Text style={styles.createBtnText}>
            {loading ? 'Creating...' : isScheduled ? 'Schedule Room' : 'Go Live Now'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showCatModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCatModal(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Category</Text>
            <FlatList
              data={CATEGORIES}
              keyExtractor={(c) => c}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.catItem, category === item && styles.catItemActive]}
                  onPress={() => { setCategory(item); setShowCatModal(false); }}
                >
                  <Text style={[styles.catItemText, category === item && styles.catItemTextActive]}>{item}</Text>
                  {category === item && <Ionicons name="checkmark" size={18} color="#4FC3F7" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#222' },
  content: { padding: 20, gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: '#f7f8fa', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#222', borderWidth: 1, borderColor: '#eee' },
  textArea: { height: 90, textAlignVertical: 'top' },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f7f8fa', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: '#eee' },
  pickerText: { fontSize: 15, color: '#222', fontWeight: '500' },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 4, paddingVertical: 4 },
  scheduleRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scheduleLabel: { fontSize: 16, fontWeight: '600', color: '#222' },
  schedulePicker: { backgroundColor: '#f7f8fa', borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: '#eee' },
  subLabel: { fontSize: 12, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, marginTop: 8 },
  dayScroll: { flexGrow: 0 },
  dayChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: 8, borderWidth: 1.5, borderColor: '#e0e0e0' },
  dayChipActive: { backgroundColor: '#4FC3F7', borderColor: '#4FC3F7' },
  dayChipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  dayChipTextActive: { color: '#fff' },
  timeRow: { gap: 12 },
  timeGroup: { gap: 6 },
  timeGroupLabel: { fontSize: 11, color: '#aaa', fontWeight: '600', letterSpacing: 0.3 },
  minRow: { flexDirection: 'row', gap: 8 },
  ampmRow: { flexDirection: 'row', gap: 8 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#fff', marginRight: 8, borderWidth: 1.5, borderColor: '#e0e0e0' },
  timeChipActive: { backgroundColor: '#4FC3F7', borderColor: '#4FC3F7' },
  timeChipText: { fontSize: 14, color: '#555', fontWeight: '600' },
  timeChipTextActive: { color: '#fff' },
  previewBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(79,195,247,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 },
  previewText: { fontSize: 13, color: '#4FC3F7', fontWeight: '600' },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#4FC3F7', borderRadius: 16, paddingVertical: 16, marginTop: 28, marginBottom: 8 },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#222', marginBottom: 16 },
  catItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  catItemActive: {},
  catItemText: { fontSize: 16, color: '#333' },
  catItemTextActive: { color: '#4FC3F7', fontWeight: '700' },
});
