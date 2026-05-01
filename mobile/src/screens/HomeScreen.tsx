import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Switch, Linking, RefreshControl,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { startLocationTracking, stopLocationTracking, getSocket } from '../lib/locationService';
import type { Order } from '../../types';

const C = {
  bg: '#0a1628', card: '#0f2340', border: '#1e4976',
  orange: '#f97316', text: '#f0f4f8', muted: '#64748b',
  green: '#22c55e', red: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Onaylandı', assigning: 'Kurye Aranıyor', assigned: 'Atandı',
  pickup: 'Alım Yapıldı', in_transit: 'Yolda', delivered: 'Teslim Edildi',
  cancelled: 'İptal',
};

interface Props {
  courierId: string;
  onLogout: () => void;
}

export default function HomeScreen({ courierId, onLogout }: Props) {
  const [isOnline, setIsOnline] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('courier_id', courierId)
      .in('status', ['assigned', 'pickup', 'in_transit', 'delivered'])
      .order('created_at', { ascending: false })
      .limit(20);
    setOrders((data || []) as Order[]);
  }, [courierId]);

  useEffect(() => {
    supabase.from('profiles').select('full_name').eq('id', courierId).single()
      .then(({ data }) => setProfile(data));
    fetchOrders().finally(() => setLoading(false));

    // Listen for new jobs
    const socket = getSocket();
    socket?.on('courier:new:job', () => {
      fetchOrders();
      Alert.alert('🎉 Yeni İş!', 'Size yeni bir sipariş atandı!');
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

  const openNavigation = (lat: number, lng: number, label: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(label)}&travelmode=driving`;
    Linking.openURL(url);
  };

  const updateOrderStatus = async (orderId: string, status: string, trackingCode: string) => {
    await supabase.from('orders').update({ status }).eq('id', orderId);
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: status as Order['status'] } : o));
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.trackingCode}>{item.tracking_code}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{STATUS_LABELS[item.status] || item.status}</Text>
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
          {' '}{item.weight_kg} kg
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        {item.status === 'assigned' && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#1e4976' }]}
              onPress={() => openNavigation(item.pickup_lat, item.pickup_lng, item.pickup_address)}
            >
              <Text style={styles.actionBtnText}>🗺️ Yol Tarifi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: C.orange }]}
              onPress={() => updateOrderStatus(item.id, 'pickup', item.tracking_code)}
            >
              <Text style={styles.actionBtnText}>📦 Paketi Aldım</Text>
            </TouchableOpacity>
          </>
        )}
        {item.status === 'pickup' && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#1e4976' }]}
              onPress={() => openNavigation(item.dropoff_lat, item.dropoff_lng, item.dropoff_address)}
            >
              <Text style={styles.actionBtnText}>🗺️ Teslimat Yolu</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: C.orange }]}
              onPress={() => updateOrderStatus(item.id, 'in_transit', item.tracking_code)}
            >
              <Text style={styles.actionBtnText}>🚀 Yola Çıktım</Text>
            </TouchableOpacity>
          </>
        )}
        {item.status === 'in_transit' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: C.green, flex: 1 }]}
            onPress={() => updateOrderStatus(item.id, 'delivered', item.tracking_code)}
          >
            <Text style={styles.actionBtnText}>✅ Teslim Ettim</Text>
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
          <Switch
            value={isOnline}
            onValueChange={toggleOnline}
            trackColor={{ false: C.border, true: C.orange }}
            thumbColor={isOnline ? '#fff' : '#94a3b8'}
          />
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Çıkış</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Orders */}
      {loading ? (
        <ActivityIndicator color={C.orange} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchOrders(); setRefreshing(false); }} tintColor={C.orange} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>{isOnline ? 'Sipariş bekleniyor...' : 'Online olun ve siparişleri görün'}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 60, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  greeting: { color: C.text, fontSize: 18, fontWeight: 'bold' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 13, fontWeight: '500' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoutBtn: { padding: 6 },
  logoutText: { color: C.muted, fontSize: 13 },
  listContent: { padding: 16, gap: 12 },
  orderCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  trackingCode: { color: C.orange, fontWeight: 'bold', fontFamily: 'monospace', fontSize: 14 },
  statusBadge: { backgroundColor: '#1e4976', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusText: { color: C.text, fontSize: 11, fontWeight: '600' },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  addrLabel: { color: C.muted, fontSize: 12, width: 70 },
  addrText: { color: '#94a3b8', fontSize: 12, flex: 1 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  price: { color: C.orange, fontWeight: 'bold', fontSize: 16 },
  vehicle: { color: '#94a3b8', fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: C.muted, textAlign: 'center', fontSize: 15 },
});
