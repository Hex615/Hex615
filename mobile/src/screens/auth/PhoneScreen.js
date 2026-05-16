import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import api from '../../services/api';

export default function PhoneScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) return Alert.alert('Invalid', 'Enter a valid phone number');

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>LMK</Text>
        <Text style={styles.tagline}>Connect. Vibe. Talk.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Your phone number</Text>
          <View style={styles.inputRow}>
            <Text style={styles.flag}>🇺🇸 +1</Text>
            <TextInput
              style={styles.input}
              placeholder="(555) 000-0000"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={14}
            />
          </View>
          <Text style={styles.hint}>We'll send you a verification code</Text>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSend}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Continue →</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.terms}>
          By continuing you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#4FC3F7' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 52, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: -2 },
  tagline: { fontSize: 16, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 24, elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20 },
  label: { fontSize: 13, color: '#888', marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14, paddingHorizontal: 12, marginBottom: 10 },
  flag: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, fontSize: 18, paddingVertical: 14, color: '#222' },
  hint: { fontSize: 12, color: '#aaa', marginBottom: 20 },
  btn: { backgroundColor: '#4FC3F7', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  terms: { textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 24, lineHeight: 16 },
});
