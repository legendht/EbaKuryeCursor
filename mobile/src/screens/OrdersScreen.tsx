import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image, Modal, ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { absoluteUrl } from '../lib/urls';
import type { Order } from '../../types';

const C = {
  bg: '#0a1628', card: '#0f2340', border: '#1e4976',
  orange: '#f97316', text: '#f0f4f8', muted: '#64748b',
  green: '#22c55e', red: '#ef4444', yellow: '#eab308', blue: '#3b82f6',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Beklemede', confirmed: 'Onaylandı', assigning: 'Kurye Aranıyor',
  assigned: 'Atandı', pickup: 'Paket Alındı', in_transit: 'Yolda',
  delivered: 'Teslim Edildi', cancelled: 'İptal',
};

const STATUS_COLORS: Record<string, string> = {
  delivered: C.green,
  cancelled: C.red,
  pickup: C.yellow,
  in_transit: C.blue,
  assigned: C.orange,
};

type Filter = 'active' | 'done' | 'all';

interface Props {
  courierId: string;
  onBack: () => void;
}

type OrderWithProofs = Order & {
  pickup_photo_url: string | null;
  delivery_photo_url: string | null;
  pickup_signature_url: string | null;
  delivery_signature_url: string | null;
  paid_from_balance?: boolean;
  delivered_at?: string | null;
};

export default function OrdersScreen({ courierId, onBack }: Props) {
  const [orders, setOrders] = useState<OrderWithProofs[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [detail, setDetail] = useState<OrderWithProofs | null>(null);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('courier_id', courierId)
      .order('created_at', { ascending: false })
      .limit(200);
    setOrders((data || []) as OrderWithProofs[]);
  }, [courierId]);

  useEffect(() => {
    fetchOrders().finally(() => setLoading(false));
  }, [fetchOrders]);

  const activeStatuses = ['assigned', 'pickup', 'in_transit'];
  const doneStatuses = ['delivered', 'cancelled', 'failed'];

  const filtered = orders.filter((o) => {
    if (filter === 'active') return activeStatuses.includes(o.status);
    if (filter === 'done') return doneStatuses.includes(o.status);
    return true;
  });

  const stats = {
    total: orders.length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    active: orders.filter((o) => activeStatuses.includes(o.status)).length,
  };

  const renderItem = ({ item }: { item: OrderWithProofs }) => (
    <TouchableOpacity style={styles.orderCard} onPress={() => setDetail(item)}>
      <View style={styles.rowTop}>
        <Text style={styles.trackingCode}>{item.tracking_code}</Text>
        <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] ?? C.muted) + '30' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] ?? C.muted }]}>
            {STATUS_LABELS[item.status] || item.status}
          </Text>
        </View>
      </View>
      <Text style={styles.addrText} numberOfLines={1}>📍 {item.pickup_address}</Text>
      <Text style={styles.addrText} numberOfLines={1}>🏁 {item.dropoff_address}</Text>
      <View style={styles.rowBottom}>
        <Text style={styles.date}>
          {new Date(item.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={styles.price}>₺{item.total_price}</Text>
      </View>
      {item.paid_from_balance && (
        <View style={styles.paidBadge}>
          <Text style={styles.paidText}>✓ Bakiye Ödendi</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Siparişlerim</Text>
      </View>

      <View style={styles.statsRow}>
        <StatBox label="Toplam" value={stats.total} color={C.text} />
        <StatBox label="Teslim" value={stats.delivered} color={C.green} />
        <StatBox label="Aktif" value={stats.active} color={C.orange} />
      </View>

      <View style={styles.filterRow}>
        {(['all', 'active', 'done'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && { color: '#fff' }]}>
              {f === 'all' ? 'Tümü' : f === 'active' ? 'Aktif' : 'Tamamlanan'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={C.orange} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyText}>Sipariş yok</Text>
            </View>
          }
        />
      )}

      {/* Detay modalı */}
      <Modal visible={!!detail} animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setDetail(null)} style={styles.backBtn}>
              <Text style={styles.backText}>← Kapat</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Sipariş Detay</Text>
          </View>
          {detail && (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              <View style={styles.detailCard}>
                <View style={styles.rowTop}>
                  <Text style={styles.trackingCode}>{detail.tracking_code}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[detail.status] ?? C.muted) + '30' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[detail.status] ?? C.muted }]}>
                      {STATUS_LABELS[detail.status] || detail.status}
                    </Text>
                  </View>
                </View>

                <DetailRow label="Tarih" value={new Date(detail.created_at).toLocaleString('tr-TR')} />
                {detail.delivered_at && (
                  <DetailRow label="Teslim" value={new Date(detail.delivered_at).toLocaleString('tr-TR')} />
                )}
                <DetailRow label="📍 Alım" value={detail.pickup_address} />
                <DetailRow label="🏁 Teslimat" value={detail.dropoff_address} />
                {detail.pickup_contact && <DetailRow label="Gönderici" value={`${detail.pickup_contact} · ${detail.pickup_phone || ''}`} />}
                {detail.dropoff_contact && <DetailRow label="Alıcı" value={`${detail.dropoff_contact} · ${detail.dropoff_phone || ''}`} />}
                <DetailRow label="Ağırlık" value={`${detail.weight_kg} kg`} />
                <DetailRow label="Mesafe" value={`${detail.distance_km?.toFixed(1)} km`} />
                <DetailRow label="Tutar" value={`₺${detail.total_price}`} valueColor={C.orange} />
                {detail.paid_from_balance && (
                  <View style={styles.paidNotice}>
                    <Text style={styles.paidNoticeText}>✓ Bakiye ödenmiştir – nakit/kart tahsilatı yapmayın</Text>
                  </View>
                )}
                {detail.description && <DetailRow label="Açıklama" value={detail.description} />}
                {detail.notes && <DetailRow label="Not" value={detail.notes} />}
              </View>

              {/* Kanıt fotoğrafları */}
              <Text style={styles.sectionTitle}>📷 Kanıtlar</Text>
              <View style={styles.proofGrid}>
                <ProofThumb
                  label="Alım Fotoğrafı"
                  url={absoluteUrl(detail.pickup_photo_url)}
                  onPress={setViewPhoto}
                />
                <ProofThumb
                  label="Alım İmzası"
                  url={absoluteUrl(detail.pickup_signature_url)}
                  onPress={setViewPhoto}
                />
                <ProofThumb
                  label="Teslim Fotoğrafı"
                  url={absoluteUrl(detail.delivery_photo_url)}
                  onPress={setViewPhoto}
                />
                <ProofThumb
                  label="Teslim İmzası"
                  url={absoluteUrl(detail.delivery_signature_url)}
                  onPress={setViewPhoto}
                />
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Foto görüntüleme */}
      <Modal visible={!!viewPhoto} transparent animationType="fade" onRequestClose={() => setViewPhoto(null)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setViewPhoto(null)}
          activeOpacity={1}
        >
          {viewPhoto && <Image source={{ uri: viewPhoto }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
          <Text style={{ color: '#fff', marginTop: 16, opacity: 0.7 }}>Kapatmak için dokunun</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor ? { color: valueColor, fontWeight: '700' } : null]}>{value}</Text>
    </View>
  );
}

function ProofThumb({ label, url, onPress }: { label: string; url: string | null; onPress: (u: string) => void }) {
  if (!url) {
    return (
      <View style={[styles.proofItem, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: C.muted, fontSize: 11, textAlign: 'center' }}>{label}{'\n'}— Yok —</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity style={styles.proofItem} onPress={() => onPress(url)}>
      <Image source={{ uri: url }} style={styles.proofImg} />
      <Text style={styles.proofLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 },
  backBtn: { padding: 6 },
  backText: { color: C.orange, fontSize: 16 },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 8, padding: 12 },
  statBox: { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: C.muted, marginTop: 2 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 6 },
  filterBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  filterBtnActive: { backgroundColor: C.orange, borderColor: C.orange },
  filterText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  listContent: { padding: 12, gap: 10, paddingBottom: 40 },
  orderCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  trackingCode: { color: C.orange, fontWeight: 'bold', fontFamily: 'monospace', fontSize: 13 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '600' },
  addrText: { color: '#94a3b8', fontSize: 12 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.border },
  date: { color: C.muted, fontSize: 11 },
  price: { color: C.text, fontWeight: '700', fontSize: 14 },
  paidBadge: { marginTop: 6, alignSelf: 'flex-start', backgroundColor: C.green + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  paidText: { color: C.green, fontSize: 11, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: C.muted, fontSize: 14 },
  detailCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  detailRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border + '40' },
  detailLabel: { color: C.muted, fontSize: 11, marginBottom: 2 },
  detailValue: { color: C.text, fontSize: 13 },
  paidNotice: { marginTop: 10, backgroundColor: C.green + '20', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: C.green + '50' },
  paidNoticeText: { color: C.green, fontWeight: '700', textAlign: 'center', fontSize: 13 },
  sectionTitle: { color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  proofGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  proofItem: { width: '47%', aspectRatio: 1, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  proofImg: { width: '100%', height: '80%' },
  proofLabel: { color: C.text, fontSize: 10, textAlign: 'center', paddingVertical: 4 },
});
