import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView, Image,
} from 'react-native';
import { supabase } from '../lib/supabase';

const C = {
  bg: '#0a1628', card: '#0f2340', border: '#1e4976',
  orange: '#f97316', text: '#f0f4f8', muted: '#64748b', green: '#22c55e',
};

interface Props {
  onLogin: (courierId: string) => void;
  onRegister: () => void;
  pendingApproval?: boolean;
}

export default function LoginScreen({ onLogin, onRegister, pendingApproval }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Hata', 'E-posta ve şifre giriniz.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      Alert.alert('Giriş Hatası', error?.message || 'Giriş başarısız');
      setLoading(false);
      return;
    }

    const { data: courier } = await supabase
      .from('couriers')
      .select('id, is_approved')
      .eq('id', data.user.id)
      .single();

    if (!courier) {
      Alert.alert('Hata', 'Bu hesap kurye hesabı değil. Lütfen "Üye Ol" ile kayıt olun.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (!courier.is_approved) {
      Alert.alert(
        '⏳ Onay Bekleniyor',
        'Başvurunuz yönetici onayı bekliyor.\nOnaylandıktan sonra giriş yapabilirsiniz.'
      );
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    onLogin(courier.id);
    setLoading(false);
  };

  if (pendingApproval) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <Text style={{ fontSize: 60, marginBottom: 20 }}>⏳</Text>
        <Text style={[styles.title, { textAlign: 'center', marginBottom: 8 }]}>Onay Bekleniyor</Text>
        <Text style={{ color: C.muted, textAlign: 'center', fontSize: 15, lineHeight: 22 }}>
          Başvurunuz yöneticiye iletildi.{'\n'}
          Onaylandıktan sonra giriş yapabilirsiniz.
        </Text>
        <TouchableOpacity
          style={[styles.btn, { marginTop: 32, backgroundColor: C.border }]}
          onPress={async () => {
            await supabase.auth.signOut();
          }}
        >
          <Text style={styles.btnText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.avatarRing}>
            <View style={styles.logoBox}>
              <Text style={styles.logoEmoji}>📦</Text>
            </View>
          </View>
          <Text style={styles.title}>
            <Text style={{ color: C.text }}>EBA</Text>
            <Text style={{ color: C.orange }}> Kurye</Text>
          </Text>
          <Text style={styles.subtitle}>Kurye Uygulaması</Text>
        </View>

        {/* Form */}
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

        {/* Register */}
        <View style={styles.registerRow}>
          <Text style={styles.registerText}>Henüz üye değil misiniz?</Text>
          <TouchableOpacity onPress={onRegister}>
            <Text style={styles.registerLink}> Üye Ol</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  logoContainer: { alignItems: 'center', marginBottom: 36 },
  avatarRing: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, borderColor: C.orange,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  logoBox: {
    width: 80, height: 80, backgroundColor: C.orange, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  logoEmoji: { fontSize: 38 },
  title: { fontSize: 28, fontWeight: 'bold' },
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
  registerRow: {
    flexDirection: 'row', justifyContent: 'center', marginTop: 24, alignItems: 'center',
  },
  registerText: { color: C.muted, fontSize: 14 },
  registerLink: { color: C.orange, fontSize: 14, fontWeight: '700' },
});
