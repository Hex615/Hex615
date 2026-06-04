import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { C } from '../../theme';

export default function OTPScreen({ route, navigation }) {
  const { phone } = route.params;
  const [code, setCode]     = useState(['', '', '', '', '', '']);
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
      await AsyncStorage.setItem('accessToken',  res.data.accessToken);
      await AsyncStorage.setItem('refreshToken', res.data.refreshToken);
      setUser(res.data.user);
      if (res.data.isNew || !res.data.user.username) navigation.replace('Onboarding');
    } catch (err) {
      Alert.alert('Wrong code', err.response?.data?.error || 'Please try again');
      setCode(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await api.post('/auth/send-otp', { phone });
      Alert.alert('Sent!', 'A new code was sent to ' + phone);
    } catch {
      Alert.alert('', 'Could not resend. Try again shortly.');
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={s.title}>Enter the code</Text>
        <Text style={s.sub}>Sent to {phone}</Text>

        <View style={s.codeRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => (inputs.current[i] = r)}
              style={[s.box, digit && s.boxFilled]}
              value={digit}
              onChangeText={(v) => handleChange(v, i)}
              keyboardType="number-pad"
              maxLength={1}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Backspace' && !digit && i > 0)
                  inputs.current[i - 1]?.focus();
              }}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[s.btn, loading && s.btnDim]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={s.btnText}>Verify ⚡</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResend} style={s.resendWrap}>
          <Text style={s.resend}>Resend code</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  inner:      { flex: 1, padding: 24, paddingTop: 60 },
  back:       { marginBottom: 36 },
  backText:   { color: C.purple, fontSize: 16, fontWeight: '600' },
  title:      { fontSize: 28, fontWeight: '800', color: C.white, marginBottom: 8 },
  sub:        { fontSize: 14, color: C.sub, marginBottom: 40 },
  codeRow:    { flexDirection: 'row', gap: 10, marginBottom: 32 },
  box: {
    flex: 1, height: 58, borderWidth: 1.5, borderColor: C.border,
    borderRadius: 14, textAlign: 'center', fontSize: 24, fontWeight: '800',
    color: C.white, backgroundColor: C.surface,
  },
  boxFilled:  { borderColor: C.purple, backgroundColor: C.purpleDim },
  btn:        { backgroundColor: C.yellow, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  btnDim:     { opacity: 0.5 },
  btnText:    { color: '#000', fontSize: 16, fontWeight: '800' },
  resendWrap: { alignItems: 'center' },
  resend:     { color: C.purple, fontSize: 14, fontWeight: '600' },
});
