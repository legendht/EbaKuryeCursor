import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as Location from 'expo-location';
import { useCameraPermissions } from 'expo-camera';

const C = {
  bg: '#0a1628', card: '#0f2340', border: '#1e4976',
  orange: '#f97316', text: '#f0f4f8', muted: '#64748b',
  green: '#22c55e',
};

interface Props { onGranted: () => void; }

export default function PermissionsScreen({ onGranted }: Props) {
  const [locGranted, setLocGranted] = useState(false);
  const [camGranted, setCamGranted] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [, requestCameraPermission] = useCameraPermissions();

  const requestAll = async () => {
    setRequesting(true);
    try {
      // Foreground location
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      // Background location
      if (fgStatus === 'granted') {
        await Location.requestBackgroundPermissionsAsync();
        setLocGranted(true);
      } else {
        Alert.alert('Konum İzni', 'Konum izni kurye uygulaması için zorunludur. Lütfen ayarlardan izin verin.');
      }

      // Camera
      const camResult = await requestCameraPermission();
      if (camResult.granted) {
        setCamGranted(true);
      } else {
        Alert.alert('Kamera İzni', 'Kamera izni teslimat fotoğrafları için gereklidir.');
      }

      if (fgStatus === 'granted' && camResult.granted) {
        onGranted();
      }
    } catch (e) {
      Alert.alert('Hata', 'İzin alınırken hata oluştu.');
    } finally {
      setRequesting(false);
    }
  };

  const continueAnyway = () => {
    if (!locGranted) {
      Alert.alert('Uyarı', 'Konum izni olmadan Online olamazsınız.');
    }
    onGranted();
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoBox}>
        <Text style={styles.logoEmoji}>📦</Text>
      </View>
      <Text style={styles.title}>
        <Text style={{ color: C.text }}>EBA</Text>
        <Text style={{ color: C.orange }}> Kurye</Text>
      </Text>
      <Text style={styles.subtitle}>Uygulama için izinler gerekiyor</Text>

      <View style={styles.card}>
        <PermItem
          icon="📍"
          title="Konum İzni"
          desc="Siparişleri yönetmek ve arka planda GPS göndermek için"
          granted={locGranted}
        />
        <PermItem
          icon="📷"
          title="Kamera İzni"
          desc="Teslimat kanıtı fotoğrafı çekmek için"
          granted={camGranted}
        />
      </View>

      <TouchableOpacity
        style={[styles.btn, requesting && styles.btnDisabled]}
        onPress={requestAll}
        disabled={requesting}
      >
        <Text style={styles.btnText}>
          {requesting ? 'İzinler İsteniyor...' : '✅ İzinleri Ver'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={continueAnyway} style={styles.skipBtn}>
        <Text style={styles.skipText}>Şimdilik Atla</Text>
      </TouchableOpacity>
    </View>
  );
}

function PermItem({ icon, title, desc, granted }: {
  icon: string; title: string; desc: string; granted: boolean;
}) {
  return (
    <View style={pStyles.row}>
      <Text style={pStyles.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={pStyles.title}>{title}</Text>
        <Text style={pStyles.desc}>{desc}</Text>
      </View>
      <Text style={{ fontSize: 20 }}>{granted ? '✅' : '⭕'}</Text>
    </View>
  );
}

const pStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  icon: { fontSize: 28 },
  title: { color: C.text, fontWeight: '600', fontSize: 15 },
  desc: { color: C.muted, fontSize: 12, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: C.bg, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 24,
  },
  logoBox: {
    width: 80, height: 80, backgroundColor: C.orange, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  logoEmoji: { fontSize: 40 },
  title: { fontSize: 30, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: C.muted, fontSize: 14, marginBottom: 32 },
  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border, width: '100%',
    marginBottom: 24,
    gap: 4,
  },
  btn: {
    backgroundColor: C.orange, borderRadius: 14, paddingVertical: 16,
    paddingHorizontal: 40, alignItems: 'center', width: '100%',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipBtn: { marginTop: 16 },
  skipText: { color: C.muted, fontSize: 14 },
});
