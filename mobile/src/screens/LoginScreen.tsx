import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';

const C = {
  bg: '#0a1628',
  card: '#0f2340',
  border: '#1e4976',
  orange: '#f97316',
  text: '#f0f4f8',
  muted: '#64748b',
};

interface Props {
  onLogin: (courierId: string) => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      Alert.alert('Hata', error?.message || 'Giriş başarısız');
      setLoading(false);
      return;
    }

    // Check if user is a courier
    const { data: courier } = await supabase
      .from('couriers')
      .select('id, is_approved')
      .eq('id', data.user.id)
      .single();

    if (!courier) {
      Alert.alert('Hata', 'Bu hesap kurye hesabı değil.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (!courier.is_approved) {
      Alert.alert('Uyarı', 'Hesabınız henüz onaylanmamış. Lütfen yöneticiyle iletişime geçin.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    onLogin(courier.id);
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}>
            <Text style={styles.logoEmoji}>📦</Text>
          </View>
          <Text style={styles.logoText}>
            <Text style={{ color: C.text }}>EBA</Text>
            <Text style={{ color: C.orange }}> Kurye</Text>
          </Text>
          <Text style={styles.subtitle}>Kurye Uygulaması</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>E-posta</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={C.muted}
            placeholder="kurye@ebakurye.com"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Şifre</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={C.muted}
            placeholder="••••••••"
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Giriş Yap</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoBox: {
    width: 72, height: 72, backgroundColor: C.orange, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  logoEmoji: { fontSize: 36 },
  logoText: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: C.muted, marginTop: 4, fontSize: 14 },
  form: {
    backgroundColor: C.card, borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: C.border,
  },
  label: { color: '#94a3b8', fontSize: 13, marginBottom: 6, fontWeight: '500' },
  input: {
    backgroundColor: '#0a1628', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: C.border, color: C.text, fontSize: 15,
  },
  btn: {
    backgroundColor: C.orange, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
