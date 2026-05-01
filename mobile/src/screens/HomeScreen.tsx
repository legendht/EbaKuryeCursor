import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Switch, Linking, RefreshControl,
  Modal, TextInput, ScrollView, Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../lib/supabase';
import { startLocationTracking, stopLocationTracking, getSocket } from '../lib/locationService';
import type { Order } from '../../types';

const C = {
  bg: '#0a1628', card: '#0f2340', border: '#1e4976',
  orange: '#f97316', text: '#f0f4f8', muted: '#64748b',
  green: '#22c55e', red: '#ef4444', yellow: '#eab308',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Beklemede', confirmed: 'Onaylandı', assigning: 'Kurye Aranıyor',
  assigned: 'Atandı', pickup: 'Paket Alındı', in_transit: 'Yolda',
  delivered: 'Teslim Edildi', cancelled: 'İptal',
};

const REJECT_REASONS = [
  'Trafik yoğunluğu', 'Araç arızası', 'Mesafe çok uzak',
  'Hastayım', 'Yakıt yok', 'Yolda başka iş var', 'Diğer',
];

interface Props { courierId: string; onLogout: () => void; }

export default function HomeScreen({ courierId, onLogout }: Props) {
  const [isOnline, setIsOnline] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);

  // New job alert
  const [newJob, setNewJob] = useState<Order | null>(null);

  // Reject modal
  const [rejectOrder, setRejectOrder] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Camera
  const [cameraModal, setCameraModal] = useState<{ orderId: string; phase: 'pickup' | 'delivery' } | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('courier_id', courierId)
      .in('status', ['assigned', 'pickup', 'in_transit'])
      .order('created_at', { ascending: false })
      .limit(20);
    setOrders((data || []) as Order[]);
  }, [courierId]);

  useEffect(() => {
    supabase.from('profiles').select('full_name').eq('id', courierId).single()
      .then(({ data }) => setProfile(data));
    fetchOrders().finally(() => setLoading(false));

    const socket = getSocket();
    socket?.on('courier:new:job', async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('courier_id', courierId)
        .eq('status', 'assigned')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (data) setNewJob(data as Order);
      fetchOrders();
    });

    return () => { socket?.off('courier:new:job'); };
  }, [courierId, fetchOrders]);

  const toggleOnline = async (val: boolean) => {
    setIsOnline(val);
    if (val) {
      try {
        await startLocationTracking(courierId);
        await supabase.from('couriers').update({ status: 'online' }).eq('id', courierId);
      } catch (err: unknown) {
        Alert.alert('Hata', err instanceof Error ? err.message : 'Konum başlatılamadı');
        setIsOnline(false);
      }
    } else {
      stopLocationTracking();
      await supabase.from('couriers').update({ status: 'offline' }).eq('id', courierId);
    }
  };

  const handleLogout = async () => {
    stopLocationTracking();
    await supabase.auth.signOut();
    onLogout();
  };

  const openNavigation = (lat: number, lng: number) => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`);
  };

  const updateStatus = async (orderId: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', orderId);
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: status as Order['status'] } : o));
  };

  // Accept new job
  const acceptJob = async (order: Order) => {
    setNewJob(null);
    await updateStatus(order.id, 'assigned');
    fetchOrders();
  };

  // Reject new job via SQL function
  const openRejectModal = (order: Order) => {
    setRejectOrder(order);
    setRejectReason('');
    setCustomReason('');
    setNewJob(null);
  };

  const submitReject = async () => {
    if (!rejectOrder) return;
    const reason = rejectReason === 'Diğer' ? customReason : rejectReason;
    if (!reason.trim()) { Alert.alert('Uyarı', 'Lütfen red sebebi seçin'); return; }
    setRejecting(true);
    const { error } = await supabase.rpc('reject_assignment' as never, {
      p_order_id: rejectOrder.id,
      p_reason: reason,
    });
    setRejecting(false);
    if (error) {
      Alert.alert('Hata', error.message);
    } else {
      Alert.alert('Tamam', 'Sipariş reddedildi, yönetici bilgilendirildi.');
      setRejectOrder(null);
      fetchOrders();
    }
  };

  // Take photo and upload
  const takePhoto = async () => {
    if (!cameraRef.current || !cameraModal) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.6, base64: false });
    if (photo) setPhotoUri(photo.uri);
  };

  const uploadPhoto = async () => {
    if (!photoUri || !cameraModal) return;
    try {
      const formData = new FormData();
      formData.append('file', { uri: photoUri, type: 'image/jpeg', name: 'photo.jpg' } as never);
      formData.append('phase', cameraModal.phase);

      const res = await fetch(`${process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:3000'}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      const { url } = await res.json();

      const field = cameraModal.phase === 'pickup' ? 'pickup_photo_url' : 'delivery_photo_url';
      await supabase.from('orders').update({ [field]: url }).eq('id', cameraModal.orderId);

      const nextStatus = cameraModal.phase === 'pickup' ? 'pickup' : 'delivered';
      await updateStatus(cameraModal.orderId, nextStatus);

      setPhotoUri(null);
      setCameraModal(null);
      Alert.alert('✅', cameraModal.phase === 'pickup' ? 'Paket teslim alındı!' : 'Teslimat tamamlandı!');
    } catch {
      Alert.alert('Hata', 'Fotoğraf yüklenemedi');
    }
  };

  const openCamera = async (orderId: string, phase: 'pickup' | 'delivery') => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) { Alert.alert('İzin Gerekli', 'Kamera izni verilmedi'); return; }
    }
    setPhotoUri(null);
    setCameraModal({ orderId, phase });
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.trackingCode}>{item.tracking_code}</Text>
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'assigned' ? C.orange + '30' : '#1e4976' }]}>
          <Text style={[styles.statusText, { color: item.status === 'assigned' ? C.orange : C.text }]}>
            {STATUS_LABELS[item.status] || item.status}
          </Text>
        </View>
      </View>

      <View style={styles.addressRow}>
        <Text style={styles.addrLabel}>📍 Alım</Text>
        <Text style={styles.addrText} numberOfLines={1}>{item.pickup_address}</Text>
      </View>
      <View style={styles.addressRow}>
        <Text style={styles.addrLabel}>🏁 Teslimat</Text>
        <Text style={styles.addrText} numberOfLines={1}>{item.dropoff_address}</Text>
      </View>

      <View style={styles.orderFooter}>
        <Text style={styles.price}>₺{item.total_price}</Text>
        <Text style={styles.vehicle}>
          {item.vehicle_type === 'motorcycle' ? '🏍️' : item.vehicle_type === 'car' ? '🚗' : '🚐'}
          {'  '}{item.weight_kg} kg · {item.distance_km?.toFixed(1)} km
        </Text>
      </View>

      <View style={styles.actionRow}>
        {item.status === 'assigned' && (
          <>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#1e4976' }]}
              onPress={() => openNavigation(item.pickup_lat, item.pickup_lng)}>
              <Text style={styles.actionBtnText}>🗺️ Yol Tarifi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.orange }]}
              onPress={() => openCamera(item.id, 'pickup')}>
              <Text style={styles.actionBtnText}>📷 Paketi Aldım</Text>
            </TouchableOpacity>
          </>
        )}
        {item.status === 'pickup' && (
          <>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#1e4976' }]}
              onPress={() => openNavigation(item.dropoff_lat, item.dropoff_lng)}>
              <Text style={styles.actionBtnText}>🗺️ Teslimat Yolu</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.orange }]}
              onPress={() => updateStatus(item.id, 'in_transit')}>
              <Text style={styles.actionBtnText}>🚀 Yola Çıktım</Text>
            </TouchableOpacity>
          </>
        )}
        {item.status === 'in_transit' && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.green, flex: 1 }]}
            onPress={() => openCamera(item.id, 'delivery')}>
            <Text style={styles.actionBtnText}>📷 Teslim Ettim</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Merhaba, {profile?.full_name?.split(' ')[0]} 👋</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: isOnline ? C.green : C.muted }]} />
            <Text style={[styles.statusLabel, { color: isOnline ? C.green : C.muted }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Switch value={isOnline} onValueChange={toggleOnline}
            trackColor={{ false: C.border, true: C.orange }} thumbColor={isOnline ? '#fff' : '#94a3b8'} />
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Çıkış</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading
        ? <ActivityIndicator color={C.orange} style={{ marginTop: 40 }} size="large" />
        : (
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id}
            renderItem={renderOrder}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing}
                onRefresh={async () => { setRefreshing(true); await fetchOrders(); setRefreshing(false); }}
                tintColor={C.orange} />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>📭</Text>
                <Text style={styles.emptyText}>
                  {isOnline ? 'Sipariş bekleniyor...' : 'Online olun ve siparişleri görün'}
                </Text>
              </View>
            }
          />
        )}

      {/* ── New Job Alert Modal ── */}
      <Modal visible={!!newJob} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderColor: C.orange }]}>
            <Text style={styles.modalTitle}>🎉 Yeni İş Talebi!</Text>
            {newJob && (
              <>
                <Text style={styles.modalTrack}>{newJob.tracking_code}</Text>
                <Text style={styles.modalAddr}>📍 {newJob.pickup_address}</Text>
                <Text style={styles.modalAddr}>🏁 {newJob.dropoff_address}</Text>
                <Text style={styles.modalPrice}>₺{newJob.total_price} · {newJob.distance_km?.toFixed(1)} km</Text>
              </>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.red }]}
                onPress={() => newJob && openRejectModal(newJob)}>
                <Text style={styles.modalBtnText}>Reddet</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.green }]}
                onPress={() => newJob && acceptJob(newJob)}>
                <Text style={styles.modalBtnText}>✅ Kabul Et</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Reject Reason Modal ── */}
      <Modal visible={!!rejectOrder} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Red Sebebi</Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {REJECT_REASONS.map((r) => (
                <TouchableOpacity key={r} style={[styles.reasonBtn, rejectReason === r && styles.reasonSelected]}
                  onPress={() => setRejectReason(r)}>
                  <Text style={[styles.reasonText, rejectReason === r && { color: C.orange }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {rejectReason === 'Diğer' && (
              <TextInput style={styles.reasonInput} placeholder="Sebebi yazın..."
                placeholderTextColor={C.muted} value={customReason}
                onChangeText={setCustomReason} multiline />
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#1e4976' }]}
                onPress={() => setRejectOrder(null)}>
                <Text style={styles.modalBtnText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.red, opacity: rejecting ? 0.6 : 1 }]}
                onPress={submitReject} disabled={rejecting}>
                <Text style={styles.modalBtnText}>{rejecting ? 'Gönderiliyor...' : 'Reddet'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Camera Modal ── */}
      <Modal visible={!!cameraModal} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {photoUri ? (
            <View style={{ flex: 1 }}>
              <Image source={{ uri: photoUri }} style={{ flex: 1 }} resizeMode="cover" />
              <View style={{ flexDirection: 'row', padding: 20, gap: 12 }}>
                <TouchableOpacity style={[styles.camBtn, { backgroundColor: '#1e4976', flex: 1 }]}
                  onPress={() => setPhotoUri(null)}>
                  <Text style={styles.camBtnText}>Yeniden Çek</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.camBtn, { backgroundColor: C.green, flex: 1 }]}
                  onPress={uploadPhoto}>
                  <Text style={styles.camBtnText}>✅ Kullan</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
              <View style={{ padding: 24, flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity style={[styles.camBtn, { backgroundColor: '#1e4976' }]}
                  onPress={() => setCameraModal(null)}>
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
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 60, backgroundColor: C.card,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  greeting: { color: C.text, fontSize: 18, fontWeight: 'bold' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 13, fontWeight: '500' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoutBtn: { padding: 6 },
  logoutText: { color: C.muted, fontSize: 13 },
  listContent: { padding: 16, gap: 12 },
  orderCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  trackingCode: { color: C.orange, fontWeight: 'bold', fontFamily: 'monospace', fontSize: 14 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '600' },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  addrLabel: { color: C.muted, fontSize: 12, width: 70 },
  addrText: { color: '#94a3b8', fontSize: 12, flex: 1 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  price: { color: C.orange, fontWeight: 'bold', fontSize: 16 },
  vehicle: { color: '#94a3b8', fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: C.muted, textAlign: 'center', fontSize: 15 },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, borderWidth: 1, borderColor: C.border,
  },
  modalTitle: { color: C.text, fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  modalTrack: { color: C.orange, fontFamily: 'monospace', fontSize: 14, marginBottom: 8, textAlign: 'center' },
  modalAddr: { color: '#94a3b8', fontSize: 13, marginBottom: 4 },
  modalPrice: { color: C.text, fontWeight: 'bold', fontSize: 18, marginVertical: 12, textAlign: 'center' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  reasonBtn: { padding: 14, borderRadius: 10, borderWidth: 1, borderColor: C.border, marginBottom: 6 },
  reasonSelected: { borderColor: C.orange, backgroundColor: C.orange + '15' },
  reasonText: { color: C.text, fontSize: 14 },
  reasonInput: {
    backgroundColor: '#0a1628', borderWidth: 1, borderColor: C.border,
    borderRadius: 10, padding: 12, color: C.text, marginTop: 8, minHeight: 60,
  },
  camBtn: { padding: 14, borderRadius: 12, alignItems: 'center', minWidth: 120 },
  camBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
