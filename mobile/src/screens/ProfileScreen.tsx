import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Image,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../lib/supabase';

const C = {
  bg: '#0a1628', card: '#0f2340', border: '#1e4976',
  orange: '#f97316', text: '#f0f4f8', muted: '#64748b',
  red: '#ef4444', green: '#22c55e',
};

interface Props {
  courierId: string;
  onBack: () => void;
  onLogout: () => void;
}

export default function ProfileScreen({ courierId, onBack, onLogout }: Props) {
  const [profile, setProfile] = useState<{
    full_name: string; phone: string; email: string;
  } | null>(null);
  const [courier, setCourier] = useState<{
    vehicle_type: string; vehicle_plate: string; tc_no: string;
    profile_photo_url: string | null;
  } | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Camera for profile photo
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = React.useRef<CameraView>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('profiles').select('full_name, phone, email').eq('id', courierId).single(),
      supabase.from('couriers').select('vehicle_type, vehicle_plate, tc_no, profile_photo_url').eq('id', courierId).single(),
    ]);
    if (p) { setProfile(p); setFullName(p.full_name || ''); setPhone(p.phone || ''); }
    if (c) setCourier(c);
    setLoading(false);
  };

  const saveProfile = async () => {
    if (!fullName.trim()) { Alert.alert('Hata', 'Ad Soyad boş olamaz.'); return; }
    if (newPassword && newPassword.length < 6) { Alert.alert('Hata', 'Şifre en az 6 karakter olmalı.'); return; }
    if (newPassword && newPassword !== newPassword2) { Alert.alert('Hata', 'Şifreler eşleşmiyor.'); return; }

    setSaving(true);
    try {
      await supabase.from('profiles')
        .update({ full_name: fullName.trim(), phone: phone.trim() })
        .eq('id', courierId);

      if (newPassword) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) { Alert.alert('Şifre Hatası', error.message); setSaving(false); return; }
      }

      Alert.alert('✅', 'Profil güncellendi.');
      setNewPassword('');
      setNewPassword2('');
      loadData();
    } catch {
      Alert.alert('Hata', 'Güncelleme başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const openCamera = async () => {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) { Alert.alert('Hata', 'Kamera izni gerekli.'); return; }
    }
    setPhotoUri(null);
    setCameraOpen(true);
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false });
    if (photo) setPhotoUri(photo.uri);
  };

  const uploadProfilePhoto = async () => {
    if (!photoUri) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', { uri: photoUri, type: 'image/jpeg', name: 'profile.jpg' } as never);
      formData.append('phase', 'profile');
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:3000'}/api/upload`,
        { method: 'POST', body: formData }
      );
      const { url } = await res.json();
      await supabase.from('couriers').update({ profile_photo_url: url }).eq('id', courierId);
      setCourier((prev) => prev ? { ...prev, profile_photo_url: url } : prev);
      setPhotoUri(null);
      setCameraOpen(false);
      Alert.alert('✅', 'Profil fotoğrafı güncellendi.');
    } catch {
      Alert.alert('Hata', 'Fotoğraf yüklenemedi.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Çıkış', 'Çıkış yapmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut();
        onLogout();
      }},
    ]);
  };

  if (cameraOpen) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {photoUri ? (
          <View style={{ flex: 1 }}>
            <Image source={{ uri: photoUri }} style={{ flex: 1 }} resizeMode="cover" />
            <View style={{ flexDirection: 'row', padding: 20, gap: 12 }}>
              <TouchableOpacity style={[styles.camBtn, { backgroundColor: C.border, flex: 1 }]}
                onPress={() => setPhotoUri(null)}>
                <Text style={styles.camBtnText}>Yeniden Çek</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.camBtn, { backgroundColor: C.green, flex: 1, opacity: uploadingPhoto ? 0.6 : 1 }]}
                onPress={uploadProfilePhoto} disabled={uploadingPhoto}>
                <Text style={styles.camBtnText}>{uploadingPhoto ? 'Yükleniyor...' : '✅ Kaydet'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
            <View style={{ padding: 24, flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity style={[styles.camBtn, { backgroundColor: C.border }]}
                onPress={() => setCameraOpen(false)}>
                <Text style={styles.camBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.camBtn, { backgroundColor: C.orange }]}
                onPress={takePhoto}>
                <Text style={styles.camBtnText}>📷 Çek</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={C.orange} size="large" />
      </View>
    );
  }

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
          <Text style={styles.headerTitle}>Profil Ayarları</Text>
        </View>

        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <TouchableOpacity style={styles.photoCircle} onPress={openCamera}>
            {courier?.profile_photo_url
              ? <Image source={{ uri: courier.profile_photo_url }} style={styles.photoImg} />
              : <Text style={styles.photoPlaceholder}>👤</Text>
            }
            <View style={styles.photoBadge}>
              <Text style={{ fontSize: 14 }}>📷</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.photoName}>{profile?.full_name}</Text>
          <Text style={styles.photoEmail}>{profile?.email}</Text>
        </View>

        {/* Vehicle Info (readonly) */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>🚗 Araç Bilgileri</Text>
          <InfoRow label="Araç Tipi" value={
            courier?.vehicle_type === 'motorcycle' ? '🏍️ Motosiklet'
              : courier?.vehicle_type === 'car' ? '🚗 Otomobil'
              : '🚐 Kamyonet'
          } />
          <InfoRow label="Plaka" value={courier?.vehicle_plate || '-'} />
          {courier?.tc_no && <InfoRow label="TC No" value={courier.tc_no} />}
        </View>

        {/* Editable Profile */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>👤 Kişisel Bilgiler</Text>

          <Text style={styles.label}>Ad Soyad</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholderTextColor={C.muted}
            placeholder="Ad Soyad"
          />

          <Text style={[styles.label, { marginTop: 14 }]}>Telefon</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholderTextColor={C.muted}
            placeholder="05XX XXX XX XX"
          />

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>🔒 Şifre Değiştir</Text>
          <Text style={[styles.label]}>Yeni Şifre</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholderTextColor={C.muted}
            placeholder="Boş bırakırsanız değişmez"
          />

          <Text style={[styles.label, { marginTop: 14 }]}>Şifre Tekrar</Text>
          <TextInput
            style={styles.input}
            value={newPassword2}
            onChangeText={setNewPassword2}
            secureTextEntry
            placeholderTextColor={C.muted}
            placeholder="••••••••"
          />

          <TouchableOpacity
            style={[styles.btn, saving && styles.btnDisabled]}
            onPress={saveProfile}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>💾 Kaydet</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>🚪 Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={iStyles.row}>
      <Text style={iStyles.label}>{label}</Text>
      <Text style={iStyles.value}>{value}</Text>
    </View>
  );
}

const iStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  label: { color: C.muted, fontSize: 13 },
  value: { color: C.text, fontSize: 13, fontWeight: '600' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingBottom: 20, gap: 12,
  },
  backBtn: { padding: 8 },
  backText: { color: C.orange, fontSize: 16 },
  headerTitle: { color: C.text, fontSize: 20, fontWeight: '700' },
  photoSection: { alignItems: 'center', paddingVertical: 24 },
  photoCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#1e4976', borderWidth: 3, borderColor: C.orange,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  photoImg: { width: 92, height: 92, borderRadius: 46 },
  photoPlaceholder: { fontSize: 48 },
  photoBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: C.orange, width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  photoName: { color: C.text, fontSize: 18, fontWeight: 'bold', marginTop: 12 },
  photoEmail: { color: C.muted, fontSize: 13, marginTop: 4 },
  infoCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border, marginBottom: 16,
  },
  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border,
  },
  sectionTitle: { color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 12 },
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
  logoutBtn: {
    marginTop: 20, padding: 16, borderRadius: 12,
    backgroundColor: C.red + '20', borderWidth: 1, borderColor: C.red + '50',
    alignItems: 'center',
  },
  logoutText: { color: C.red, fontSize: 15, fontWeight: '700' },
  camBtn: { padding: 14, borderRadius: 12, alignItems: 'center', minWidth: 120 },
  camBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
