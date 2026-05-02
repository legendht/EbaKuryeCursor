import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Linking, RefreshControl,
  Modal, TextInput, ScrollView, Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import SignatureScreen from 'react-native-signature-canvas';
import { supabase } from '../lib/supabase';
import { startLocationTracking, stopLocationTracking, getSocket } from '../lib/locationService';
import { absoluteUrl } from '../lib/urls';
import type { Order } from '../../types';

const C = {
  bg: '#0a1628', card: '#0f2340', border: '#1e4976',
  orange: '#f97316', text: '#f0f4f8', muted: '#64748b',
  green: '#22c55e', red: '#ef4444', yellow: '#eab308', blue: '#3b82f6',
};

type CourierStatus = 'online' | 'offline' | 'break' | 'busy';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Beklemede', confirmed: 'Onaylandı', assigning: 'Kurye Aranıyor',
  assigned: 'Atandı', pickup: 'Paket Alındı', in_transit: 'Yolda',
  delivered: 'Teslim Edildi', cancelled: 'İptal',
};

const REJECT_REASONS = ['Motor Arıza', 'Yakıt Az', 'Hastayım', 'Diğer'];

const BREAK_REASONS = ['Yemek', 'İbadet', 'Motor Arızası', 'Dinlenme', 'Diğer'];

const STATUS_DISPLAY: Record<CourierStatus, { label: string; color: string; dot: string; emoji: string }> = {
  online:  { label: 'Online',     color: C.green,  dot: C.green,  emoji: '🟢' },
  offline: { label: 'Offline',    color: C.muted,  dot: C.muted,  emoji: '⚫' },
  break:   { label: 'Mola',       color: C.yellow, dot: C.yellow, emoji: '🟡' },
  busy:    { label: 'Siparişte',  color: C.blue,   dot: C.blue,   emoji: '🔵' },
};

const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:3000';

interface Props {
  courierId: string;
  onLogout: () => void;
  onProfile: () => void;
  onOrders: () => void;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'Merhaba';
  return 'İyi akşamlar';
}

interface DailyStats {
  deliveries: number;
  km: number;
  hours: number;
  earnings: number;
}

export default function HomeScreen({ courierId, onLogout, onProfile, onOrders }: Props) {
  const [courierStatus, setCourierStatus] = useState<CourierStatus>('offline');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; profile_photo_url?: string } | null>(null);

  const [statusModal, setStatusModal] = useState(false);
  const [breakModal, setBreakModal] = useState(false);
  const [breakReason, setBreakReason] = useState('');
  const [customBreak, setCustomBreak] = useState('');
  const [newJob, setNewJob] = useState<(Order & { paidFromBalance?: boolean }) | null>(null);
  const [rejectOrder, setRejectOrder] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [stats, setStats] = useState<DailyStats>({ deliveries: 0, km: 0, hours: 0, earnings: 0 });
  const [onlineSince, setOnlineSince] = useState<number | null>(null);

  // Camera
  const [cameraModal, setCameraModal] = useState<{ orderId: string; phase: 'pickup' | 'delivery' } | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // Delivery proof choice
  const [deliveryChoiceModal, setDeliveryChoiceModal] = useState<{ orderId: string } | null>(null);
  // Signature
  const [signatureModal, setSignatureModal] = useState<{ orderId: string } | null>(null);
  const signatureRef = useRef<React.ElementRef<typeof SignatureScreen>>(null);
  const [sigUploading, setSigUploading] = useState(false);

  // Auth token for API calls
  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

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

  const fetchDailyStats = useCallback(async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('orders')
      .select('distance_km, total_price, delivered_at, created_at, status')
      .eq('courier_id', courierId)
      .eq('status', 'delivered')
      .gte('delivered_at', startOfDay.toISOString());
    const list = data || [];
    const deliveries = list.length;
    const km = list.reduce((s, o) => s + Number(o.distance_km || 0), 0);
    const earnings = list.reduce((s, o) => s + Number(o.total_price || 0), 0);
    setStats((prev) => ({ ...prev, deliveries, km: Math.round(km * 10) / 10, earnings }));
  }, [courierId]);

  useEffect(() => {
    supabase.from('profiles').select('full_name').eq('id', courierId).single()
      .then(({ data }) => setProfile(data));
    supabase.from('couriers').select('profile_photo_url, status').eq('id', courierId).single()
      .then(({ data }) => {
        if (data) {
          setProfile((prev) => prev ? { ...prev, profile_photo_url: data.profile_photo_url } : prev);
          if (['online', 'offline', 'break', 'busy'].includes(data.status)) {
            setCourierStatus(data.status as CourierStatus);
            if (data.status === 'online' || data.status === 'busy') {
              setOnlineSince(Date.now());
            }
          }
        }
      });
    fetchOrders().finally(() => setLoading(false));
    fetchDailyStats();

    const socket = getSocket();
    socket?.on('courier:new:job', async (payload: { paidFromBalance?: boolean }) => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('courier_id', courierId)
        .eq('status', 'assigned')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (data) setNewJob({ ...(data as Order), paidFromBalance: payload?.paidFromBalance });
      fetchOrders();
    });

    return () => { socket?.off('courier:new:job'); };
  }, [courierId, fetchOrders, fetchDailyStats]);

  // Çalışma süresini dakikada bir güncelle
  useEffect(() => {
    const interval = setInterval(() => {
      if (onlineSince) {
        const hours = (Date.now() - onlineSince) / 3_600_000;
        setStats((prev) => ({ ...prev, hours: Math.round(hours * 10) / 10 }));
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [onlineSince]);

  const emitStatus = useCallback((newStatus: CourierStatus) => {
    getSocket()?.emit('courier:status:change', { courierId, status: newStatus });
  }, [courierId]);

  const applyStatus = async (newStatus: CourierStatus, reason?: string) => {
    const prev = courierStatus;
    setCourierStatus(newStatus);
    try {
      if (newStatus === 'online') {
        await startLocationTracking(courierId);
        await supabase.from('couriers').update({ status: 'online', break_reason: null }).eq('id', courierId);
        if (!onlineSince) setOnlineSince(Date.now());
      } else if (newStatus === 'break') {
        stopLocationTracking();
        await supabase.from('couriers').update({ status: 'break', break_reason: reason || null }).eq('id', courierId);
      } else if (newStatus === 'busy') {
        await supabase.from('couriers').update({ status: 'busy' }).eq('id', courierId);
      } else {
        stopLocationTracking();
        await supabase.from('couriers').update({ status: 'offline', break_reason: null }).eq('id', courierId);
        setOnlineSince(null);
      }
      emitStatus(newStatus);
    } catch (err: unknown) {
      setCourierStatus(prev);
      Alert.alert('Hata', err instanceof Error ? err.message : 'Durum değiştirilemedi');
    }
  };

  const handleStatusSelect = async (newStatus: CourierStatus) => {
    setStatusModal(false);
    if (newStatus === 'break') {
      setBreakReason('');
      setCustomBreak('');
      setBreakModal(true);
    } else {
      await applyStatus(newStatus);
    }
  };

  const confirmBreak = async () => {
    const reason = breakReason === 'Diğer' ? customBreak : breakReason;
    if (!reason.trim()) { Alert.alert('Uyarı', 'Mola sebebi seçiniz.'); return; }
    setBreakModal(false);
    await applyStatus('break', reason);
  };

  const handleLogout = async () => {
    Alert.alert('Çıkış', 'Uygulamadan çıkmak istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap', style: 'destructive',
        onPress: async () => {
          stopLocationTracking();
          await supabase.from('couriers').update({ status: 'offline' }).eq('id', courierId);
          await supabase.auth.signOut();
          onLogout();
        },
      },
    ]);
  };

  const openNavigation = (lat: number, lng: number) => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`);
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', orderId);
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: status as Order['status'] } : o));
  };

  const acceptJob = async (order: Order) => {
    setNewJob(null);
    await updateOrderStatus(order.id, 'assigned');
    await applyStatus('busy');
    fetchOrders();
  };

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

  const uploadFileToApi = async (uri: string, fileName: string, mimeType: string, phase: string) => {
    const token = await getToken();
    const formData = new FormData();
    formData.append('file', { uri, type: mimeType, name: fileName } as never);
    formData.append('phase', phase);
    const res = await fetch(`${APP_URL}/api/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    const { url } = await res.json();
    return url as string;
  };

  // ── Camera (pickup & delivery photo) ──────────────────────────────
  const takePhoto = async () => {
    if (!cameraRef.current || !cameraModal) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.6, base64: false });
    if (photo) setPhotoUri(photo.uri);
  };

  const uploadPhoto = async () => {
    if (!photoUri || !cameraModal) return;
    try {
      const url = await uploadFileToApi(photoUri, 'photo.jpg', 'image/jpeg', cameraModal.phase);
      const field = cameraModal.phase === 'pickup' ? 'pickup_photo_url' : 'delivery_photo_url';
      await supabase.from('orders').update({ [field]: url }).eq('id', cameraModal.orderId);
      const nextStatus = cameraModal.phase === 'pickup' ? 'pickup' : 'delivered';
      await updateOrderStatus(cameraModal.orderId, nextStatus);

      if (cameraModal.phase === 'delivery') {
        await supabase.from('orders').update({ delivered_at: new Date().toISOString() }).eq('id', cameraModal.orderId);
        await applyStatus('online'); // back to online after delivery
        fetchDailyStats();
      }

      setPhotoUri(null);
      setCameraModal(null);
      Alert.alert('✅', cameraModal.phase === 'pickup' ? 'Paket teslim alındı!' : 'Teslimat tamamlandı!');
      fetchOrders();
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

  // ── Signature upload ───────────────────────────────────────────────
  const handleSignatureOK = async (base64DataUrl: string) => {
    if (!signatureModal) return;
    setSigUploading(true);
    try {
      // Convert base64 data URL to blob-like object for upload
      const base64 = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
      const byteChars = atob(base64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: 'image/png' });

      const token = await getToken();
      const formData = new FormData();
      formData.append('file', blob as never, 'signature.png');
      formData.append('phase', 'delivery');
      const res = await fetch(`${APP_URL}/api/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();

      await supabase.from('orders').update({
        delivery_signature_url: url,
        delivery_photo_url: url,
        delivered_at: new Date().toISOString(),
      }).eq('id', signatureModal.orderId);
      await updateOrderStatus(signatureModal.orderId, 'delivered');
      await applyStatus('online');
      setSignatureModal(null);
      Alert.alert('✅', 'Teslimat tamamlandı!');
      fetchOrders();
      fetchDailyStats();
    } catch {
      Alert.alert('Hata', 'İmza yüklenemedi');
    } finally {
      setSigUploading(false);
    }
  };

  const sd = STATUS_DISPLAY[courierStatus];

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
        <Text style={styles.addrLabel}>🏁 Teslim</Text>
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
              onPress={() => updateOrderStatus(item.id, 'in_transit')}>
              <Text style={styles.actionBtnText}>🚀 Yola Çıktım</Text>
            </TouchableOpacity>
          </>
        )}
        {item.status === 'in_transit' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: C.green, flex: 1 }]}
            onPress={() => setDeliveryChoiceModal({ orderId: item.id })}
          >
            <Text style={styles.actionBtnText}>✅ Teslim Ettim</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const photoUrl = absoluteUrl(profile?.profile_photo_url ?? null);

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onProfile} style={styles.avatar}>
            {photoUrl
              ? <Image source={{ uri: photoUrl }} style={styles.avatarImg} />
              : <Text style={styles.avatarEmoji}>👤</Text>
            }
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingSmall}>{getGreeting()},</Text>
            <Text style={styles.greeting} numberOfLines={1}>
              {profile?.full_name?.split(' ')[0] ?? 'Kurye'} 👋
            </Text>
            <View style={styles.statusIndicator}>
              <View style={[styles.dot, { backgroundColor: sd.dot }]} />
              <Text style={[styles.statusLabel, { color: sd.color }]}>{sd.label}</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.statusBtn} onPress={() => setStatusModal((v) => !v)}>
            <Text style={styles.statusBtnText}>{sd.emoji}</Text>
            <Text style={{ color: C.muted, fontSize: 12 }}>{statusModal ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onOrders} style={styles.iconBtn}>
            <Text style={{ fontSize: 20 }}>📋</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onProfile} style={styles.iconBtn}>
            <Text style={{ fontSize: 20 }}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn}>
            <Text style={{ fontSize: 20 }}>🚪</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Günlük istatistikler ── */}
      <View style={styles.statsBar}>
        <StatMini emoji="📦" label="Teslimat" value={String(stats.deliveries)} />
        <StatMini emoji="🛣️" label="KM" value={stats.km.toFixed(1)} />
        <StatMini emoji="⏱️" label="Saat" value={stats.hours.toFixed(1)} />
        <StatMini emoji="₺" label="Kazanç" value={stats.earnings ? String(Math.round(stats.earnings)) : '0'} />
      </View>

      {statusModal && (
        <View style={styles.inlineStatusDropdown}>
          {(['online', 'break', 'offline'] as CourierStatus[]).map((s) => {
            const d = STATUS_DISPLAY[s];
            return (
              <TouchableOpacity
                key={s}
                style={[styles.inlineStatusOption, courierStatus === s && styles.statusOptionActive]}
                onPress={() => handleStatusSelect(s)}
              >
                <Text style={styles.statusOptionEmoji}>{d.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusOptionLabel, { color: d.color }]}>{d.label}</Text>
                  <Text style={styles.statusOptionDesc}>
                    {s === 'online' ? 'Konum paylaşımı başlar' : s === 'break' ? 'Mola sebebi sorulur' : 'Konum paylaşımı durur'}
                  </Text>
                </View>
                {courierStatus === s && <Text style={{ color: C.orange }}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {loading
        ? <ActivityIndicator color={C.orange} style={{ marginTop: 40 }} size="large" />
        : (
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id}
            renderItem={renderOrder}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => { setRefreshing(true); await fetchOrders(); setRefreshing(false); }}
                tintColor={C.orange}
              />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>
                  {courierStatus === 'online' ? '📭' : courierStatus === 'break' ? '☕' : courierStatus === 'busy' ? '📦' : '📵'}
                </Text>
                <Text style={styles.emptyText}>
                  {courierStatus === 'online' ? 'Sipariş bekleniyor...'
                    : courierStatus === 'break' ? 'Molada – İyi dinlenmeler!'
                    : courierStatus === 'busy' ? 'Aktif sipariş işleniyor...'
                    : 'Online olun ve siparişleri görün'}
                </Text>
              </View>
            }
          />
        )}

      {/* ── Break Reason Modal ── */}
      <Modal visible={breakModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>☕ Mola Sebebi</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {BREAK_REASONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonBtn, breakReason === r && styles.reasonSelected]}
                  onPress={() => setBreakReason(r)}
                >
                  <Text style={[styles.reasonText, breakReason === r && { color: C.orange }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {breakReason === 'Diğer' && (
              <TextInput
                style={styles.reasonInput}
                placeholder="Sebebi yazın..."
                placeholderTextColor={C.muted}
                value={customBreak}
                onChangeText={setCustomBreak}
                multiline
              />
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#1e4976' }]}
                onPress={() => setBreakModal(false)}>
                <Text style={styles.modalBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.yellow }]}
                onPress={confirmBreak}>
                <Text style={styles.modalBtnText}>Molaya Geç</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                {newJob.paidFromBalance && (
                  <View style={styles.paidNotice}>
                    <Text style={styles.paidNoticeText}>✓ Bakiye ödenmiştir – nakit/kart tahsilatı yapmayın</Text>
                  </View>
                )}
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
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonBtn, rejectReason === r && styles.reasonSelected]}
                  onPress={() => setRejectReason(r)}
                >
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
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: C.red, opacity: rejecting ? 0.6 : 1 }]}
                onPress={submitReject} disabled={rejecting}
              >
                <Text style={styles.modalBtnText}>{rejecting ? 'Gönderiliyor...' : 'Reddet'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delivery Proof Choice Modal ── */}
      <Modal visible={!!deliveryChoiceModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Teslimat Kanıtı</Text>
            <Text style={[styles.modalAddr, { textAlign: 'center', marginBottom: 16 }]}>
              Teslimat kanıtı seçin
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.proofBtn, { backgroundColor: C.orange }]}
                onPress={() => {
                  const id = deliveryChoiceModal!.orderId;
                  setDeliveryChoiceModal(null);
                  openCamera(id, 'delivery');
                }}
              >
                <Text style={styles.proofBtnEmoji}>📷</Text>
                <Text style={styles.proofBtnText}>Fotoğraf Çek</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.proofBtn, { backgroundColor: '#1e4976' }]}
                onPress={() => {
                  const id = deliveryChoiceModal!.orderId;
                  setDeliveryChoiceModal(null);
                  setSignatureModal({ orderId: id });
                }}
              >
                <Text style={styles.proofBtnEmoji}>✍️</Text>
                <Text style={styles.proofBtnText}>İmza Al</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }}
              onPress={() => setDeliveryChoiceModal(null)}>
              <Text style={{ color: C.muted }}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Signature Modal ── */}
      <Modal visible={!!signatureModal} animationType="slide">
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>✍️ Müşteri İmzası</Text>
            <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>Müşteriden ekrana imzasını atmasını isteyin</Text>
          </View>

          <View style={{ flex: 1 }}>
            <SignatureScreen
              ref={signatureRef}
              onOK={handleSignatureOK}
              onEmpty={() => Alert.alert('Uyarı', 'İmza boş, lütfen imza atın.')}
              descriptionText=""
              clearText="Temizle"
              confirmText={sigUploading ? 'Yükleniyor...' : 'Kaydet'}
              webStyle={`
                .m-signature-pad { box-shadow: none; border: none; }
                .m-signature-pad--body { border: none; }
                .m-signature-pad--footer { background-color: #0a1628; }
                .button { background: #f97316; color: white; border-radius: 8px; }
                .button.clear { background: #1e4976; }
              `}
            />
          </View>

          <TouchableOpacity
            style={{ backgroundColor: '#1e4976', margin: 16, padding: 14, borderRadius: 12, alignItems: 'center' }}
            onPress={() => setSignatureModal(null)}
          >
            <Text style={{ color: C.text, fontWeight: '700' }}>İptal</Text>
          </TouchableOpacity>
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
                  onPress={() => { setCameraModal(null); setPhotoUri(null); }}>
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

function StatMini({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <View style={styles.statMiniCard}>
      <Text style={styles.statMiniEmoji}>{emoji}</Text>
      <Text style={styles.statMiniValue}>{value}</Text>
      <Text style={styles.statMiniLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, zIndex: 20,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  greetingSmall: { color: C.muted, fontSize: 12 },
  statsBar: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: C.card + '80',
  },
  statMiniCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  statMiniEmoji: { fontSize: 16 },
  statMiniValue: { color: C.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  statMiniLabel: { color: C.muted, fontSize: 10, marginTop: 1 },
  paidNotice: { marginTop: 8, backgroundColor: C.green + '25', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: C.green + '60' },
  paidNoticeText: { color: C.green, fontWeight: '700', textAlign: 'center', fontSize: 13 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#1e4976', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.orange,
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarEmoji: { fontSize: 22 },
  greeting: { color: C.text, fontSize: 15, fontWeight: 'bold' },
  statusIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: '500' },
  statusBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#0a1628', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: C.border,
  },
  statusBtnText: { color: C.text, fontSize: 13, fontWeight: '600' },
  iconBtn: { padding: 6 },
  inlineStatusDropdown: {
    marginHorizontal: 16, marginTop: 8, marginBottom: 4,
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 8, zIndex: 30,
  },
  inlineStatusOption: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderRadius: 10, borderWidth: 1, borderColor: 'transparent', gap: 10,
  },
  listContent: { padding: 16, gap: 12 },
  orderCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  trackingCode: { color: C.orange, fontWeight: 'bold', fontFamily: 'monospace', fontSize: 14 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '600' },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  addrLabel: { color: C.muted, fontSize: 12, width: 70 },
  addrText: { color: '#94a3b8', fontSize: 12, flex: 1 },
  orderFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border,
  },
  price: { color: C.orange, fontWeight: 'bold', fontSize: 16 },
  vehicle: { color: '#94a3b8', fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: C.muted, textAlign: 'center', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, borderWidth: 1, borderColor: C.border,
  },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  modalTrack: { color: C.orange, fontFamily: 'monospace', fontSize: 14, marginBottom: 8, textAlign: 'center' },
  modalAddr: { color: '#94a3b8', fontSize: 13, marginBottom: 4 },
  modalPrice: { color: C.text, fontWeight: 'bold', fontSize: 18, marginVertical: 12, textAlign: 'center' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  proofBtn: { flex: 1, padding: 20, borderRadius: 16, alignItems: 'center', gap: 8 },
  proofBtnEmoji: { fontSize: 32 },
  proofBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  statusOption: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 8, gap: 12,
  },
  statusOptionActive: { borderColor: C.orange, backgroundColor: C.orange + '15' },
  statusOptionEmoji: { fontSize: 24 },
  statusOptionLabel: { fontSize: 15, fontWeight: '700' },
  statusOptionDesc: { color: C.muted, fontSize: 12 },
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
