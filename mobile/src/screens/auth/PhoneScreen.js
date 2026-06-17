import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { C } from '../../theme';
import api from '../../services/api';

export default function PhoneScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) return Alert.alert('Invalid', 'Enter a valid US phone number');
    setLoading(true);
    try {
      await api.post('/auth/send-otp', { phone: `+1${cleaned}` });
      navigation.navigate('OTP', { phone: `+1${cleaned}` });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>
        <Text style={s.logo}>Chatsplat</Text>
        <Text style={s.tagline}>Talk loud. Vibe louder.</Text>

        <View style={s.card}>
          <Text style={s.label}>PHONE NUMBER</Text>
          <View style={s.inputRow}>
            <Text style={s.flag}>🇺🇸 +1</Text>
            <TextInput
              style={s.input}
              placeholder="(555) 000-0000"
              placeholderTextColor={C.sub}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={14}
            />
          </View>
          <Text style={s.hint}>We'll send a 6-digit verification code</Text>

          <TouchableOpacity
            style={[s.btn, (!phone || loading) && s.btnDim]}
            onPress={handleSend}
            disabled={loading || !phone}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={s.btnText}>Continue →</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={s.terms}>By continuing you agree to our Terms &amp; Privacy Policy</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  inner:      { flex: 1, justifyContent: 'center', padding: 24 },
  logo:       { fontSize: 42, fontWeight: '900', color: C.purple, textAlign: 'center', letterSpacing: -1, marginBottom: 6 },
  tagline:    { fontSize: 15, color: C.sub, textAlign: 'center', marginBottom: 44 },
  card:       { backgroundColor: C.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: C.border },
  label:      { fontSize: 11, color: C.sub, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  inputRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface2, borderRadius: 14, paddingHorizontal: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  flag:       { fontSize: 16, marginRight: 10 },
  input:      { flex: 1, fontSize: 18, paddingVertical: 14, color: C.white },
  hint:       { fontSize: 12, color: C.sub, marginBottom: 20 },
  btn:        { backgroundColor: C.yellow, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDim:     { opacity: 0.5 },
  btnText:    { color: '#000', fontSize: 16, fontWeight: '800' },
  terms:      { textAlign: 'center', color: C.sub, fontSize: 11, marginTop: 24, lineHeight: 16 },
});
