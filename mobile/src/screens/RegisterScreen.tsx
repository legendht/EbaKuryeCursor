import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';

const C = {
  bg: '#0a1628', card: '#0f2340', border: '#1e4976',
  orange: '#f97316', text: '#f0f4f8', muted: '#64748b',
};

const VEHICLE_OPTIONS = [
  { value: 'motorcycle', label: '🏍️ Motosiklet' },
  { value: 'car', label: '🚗 Otomobil' },
  { value: 'van', label: '🚐 Kamyonet' },
];

interface Props {
  onBack: () => void;
  onRegistered: () => void;
}

export default function RegisterScreen({ onBack, onRegistered }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [tcNo, setTcNo] = useState('');
  const [vehicleType, setVehicleType] = useState<'motorcycle' | 'car' | 'van'>('motorcycle');
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !phone.trim() || !password || !plate.trim()) {
      Alert.alert('Hata', 'Tüm zorunlu alanları doldurunuz.');
      return;
    }
    if (password !== password2) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır.');
      return;
    }

    setLoading(true);
    try {
      const appUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://www.ebakurye.com';
      const res = await fetch(`${appUrl}/api/public/register-courier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          vehicle_type: vehicleType,
          vehicle_plate: plate.trim().toUpperCase(),
          tc_no: tcNo.trim() || null,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        Alert.alert('Kayıt Hatası', result.error || 'Hesap oluşturulamadı.');
        setLoading(false);
        return;
      }

      onRegistered();
    } catch (e) {
      Alert.alert('Hata', 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Geri</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Kurye Başvurusu</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>👤 Kişisel Bilgiler</Text>

          <Field label="Ad Soyad *" value={fullName} onChange={setFullName} placeholder="Ahmet Yılmaz" />
          <Field label="E-posta *" value={email} onChange={setEmail} placeholder="kurye@mail.com" keyboard="email-address" autoCapitalize="none" />
          <Field label="Telefon *" value={phone} onChange={setPhone} placeholder="05XX XXX XX XX" keyboard="phone-pad" />
          <Field label="TC Kimlik No" value={tcNo} onChange={setTcNo} placeholder="11 haneli TC No" keyboard="numeric" maxLength={11} />

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>🚗 Araç Bilgileri</Text>

          <Text style={styles.label}>Araç Tipi *</Text>
          <View style={styles.vehicleRow}>
            {VEHICLE_OPTIONS.map((v) => (
              <TouchableOpacity
                key={v.value}
                style={[styles.vehicleBtn, vehicleType === v.value && styles.vehicleBtnActive]}
                onPress={() => setVehicleType(v.value as 'motorcycle' | 'car' | 'van')}
              >
                <Text style={[styles.vehicleBtnText, vehicleType === v.value && { color: '#fff' }]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field label="Araç Plakası *" value={plate} onChange={setPlate} placeholder="34 ABC 123" autoCapitalize="characters" />

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>🔒 Şifre</Text>

          <Field label="Şifre *" value={password} onChange={setPassword} placeholder="En az 6 karakter" secure />
          <Field label="Şifre Tekrar *" value={password2} onChange={setPassword2} placeholder="Şifreyi tekrar girin" secure />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>📋 Başvuru Gönder</Text>
            }
          </TouchableOpacity>

          <Text style={styles.note}>
            Başvurunuz yönetici tarafından incelenecek.{'\n'}
            Onay sonrası giriş yapabilirsiniz.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, value, onChange, placeholder, keyboard, autoCapitalize, maxLength, secure,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  keyboard?: 'email-address' | 'phone-pad' | 'numeric'; autoCapitalize?: 'none' | 'characters';
  maxLength?: number; secure?: boolean;
}) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={fStyles.label}>{label}</Text>
      <TextInput
        style={fStyles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        keyboardType={keyboard}
        autoCapitalize={autoCapitalize || 'words'}
        maxLength={maxLength}
        secureTextEntry={secure}
      />
    </View>
  );
}

const fStyles = StyleSheet.create({
  label: { color: '#94a3b8', fontSize: 13, marginBottom: 6, fontWeight: '500' },
  input: {
    backgroundColor: '#0a1628', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: C.border, color: C.text, fontSize: 15,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingBottom: 20,
    gap: 12,
  },
  backBtn: { padding: 8 },
  backText: { color: C.orange, fontSize: 16 },
  headerTitle: { color: C.text, fontSize: 20, fontWeight: '700' },
  form: {
    backgroundColor: C.card, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: C.border,
  },
  sectionTitle: { color: C.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  label: { color: '#94a3b8', fontSize: 13, marginBottom: 6, fontWeight: '500', marginTop: 14 },
  vehicleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6 },
  vehicleBtn: {
    borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 8,
    backgroundColor: '#0a1628', flex: 1, alignItems: 'center',
  },
  vehicleBtnActive: { backgroundColor: C.orange, borderColor: C.orange },
  vehicleBtnText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  btn: {
    backgroundColor: C.orange, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  note: {
    color: C.muted, fontSize: 12, textAlign: 'center',
    marginTop: 14, lineHeight: 18,
  },
});
