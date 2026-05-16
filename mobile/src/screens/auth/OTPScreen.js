import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function OTPScreen({ route, navigation }) {
  const { phone } = route.params;
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputs = useRef([]);
  const setUser = useAuthStore((s) => s.setUser);

  const handleChange = (val, idx) => {
    const next = [...code];
    next[idx] = val;
    setCode(next);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handleVerify = async () => {
    const otp = code.join('');
    if (otp.length < 6) return Alert.alert('', 'Enter the 6-digit code');

    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { phone, code: otp });
      await AsyncStorage.setItem('accessToken', res.data.accessToken);
      await AsyncStorage.setItem('refreshToken', res.data.refreshToken);
      setUser(res.data.user);
      if (res.data.isNew || !res.data.user.username) {
        navigation.replace('Onboarding');
      }
    } catch (err) {
      Alert.alert('Invalid code', err.response?.data?.error || 'Please try again');
      setCode(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Enter the code</Text>
        <Text style={styles.sub}>Sent to {phone}</Text>

        <View style={styles.codeRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => (inputs.current[i] = r)}
              style={[styles.codeBox, digit && styles.codeBoxFilled]}
              value={digit}
              onChangeText={(v) => handleChange(v, i)}
              keyboardType="number-pad"
              maxLength={1}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Backspace' && !digit && i > 0) {
                  inputs.current[i - 1]?.focus();
                }
              }}
            />
          ))}
        </View>

        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleVerify} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.resend}>Resend code</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, padding: 24, paddingTop: 60 },
  back: { marginBottom: 32 },
  backText: { color: '#4FC3F7', fontSize: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#111', marginBottom: 8 },
  sub: { fontSize: 14, color: '#888', marginBottom: 40 },
  codeRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  codeBox: {
    flex: 1, height: 56, borderWidth: 2, borderColor: '#e0e0e0',
    borderRadius: 12, textAlign: 'center', fontSize: 22, fontWeight: '700', color: '#222',
  },
  codeBoxFilled: { borderColor: '#4FC3F7', backgroundColor: '#f0faff' },
  btn: { backgroundColor: '#4FC3F7', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resend: { textAlign: 'center', color: '#4FC3F7', fontSize: 14, fontWeight: '600' },
});
