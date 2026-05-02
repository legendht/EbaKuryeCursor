'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ORDER_STATUS_COLORS, formatPrice } from '@/lib/pricing';

type Courier = { id: string; vehicle_type: string; vehicle_plate: string; status: string; full_name: string };
type OrderRow = {
  id: string; tracking_code: string; status: string;
  pickup_address: string; dropoff_address: string;
  vehicle_type: string; total_price: number;
  courier_id: string | null; created_at: string;
  pickup_photo_url: string | null; delivery_photo_url: string | null;
  pickup_signature_url: string | null; delivery_signature_url: string | null;
  customer?: { full_name: string; phone: string } | null;
  courier?: { vehicle_type: string; vehicle_plate: string } | null;
};

const VEHICLE_ICONS: Record<string, string> = { motorcycle: '🏍️', car: '🚗', van: '🚐' };
const ACTIVE_STATUSES = ['pending', 'confirmed', 'assigning', 'assigned', 'pickup', 'in_transit'];
const STATUS_OPTIONS = [
  { value: 'pending',    label: 'Beklemede' },
  { value: 'confirmed',  label: 'Onaylandı' },
  { value: 'assigning',  label: 'Kurye Aranıyor' },
  { value: 'assigned',   label: 'Kurye Atandı' },
  { value: 'pickup',     label: 'Paket Alındı' },
  { value: 'in_transit', label: 'Yolda' },
  { value: 'delivered',  label: 'Teslim Edildi' },
  { value: 'cancelled',  label: 'İptal Edildi' },
  { value: 'failed',     label: 'Başarısız' },
];

function ProofLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center rounded-md border border-orange-500/40 bg-orange-500/10 px-2 py-1 text-[11px] font-medium text-orange-300 hover:bg-orange-500/20"
    >
      {label}
    </a>
  );
}

interface Props {
  order: OrderRow;
  couriers: Courier[];
}

export default function AdminOrderRow({ order, couriers }: Props) {
  const [status, setStatus] = useState(order.status);
  const [courierId, setCourierId] = useState(order.courier_id || '');
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(order.status === 'cancelled');

  const isDone = ['delivered', 'cancelled', 'failed'].includes(status);

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error || 'Güncelleme başarısız');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    try {
      await patch({ status: newStatus });
      setStatus(newStatus);
      toast.success('Durum güncellendi');
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCourierChange = async (newCourierId: string) => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = { courierId: newCourierId || null };
      if (newCourierId && status !== 'assigned') body.status = 'assigned';
      await patch(body);
      setCourierId(newCourierId);
      if (newCourierId && status !== 'assigned') setStatus('assigned');
      toast.success(newCourierId ? 'Kurye atandı' : 'Kurye kaldırıldı');
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm(`Sipariş ${order.tracking_code} iptal edilsin mi?`)) return;
    setCancelling(true);
    try {
      await patch({ status: 'cancelled' });
      setStatus('cancelled');
      setCancelled(true);
      toast.success('Sipariş iptal edildi');
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <tr className={`border-b border-[#1e4976]/20 transition-colors ${cancelled ? 'opacity-40' : 'hover:bg-[#1e4976]/10'}`}>
      {/* Date */}
      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
        {new Date(order.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
      </td>

      {/* Tracking / Customer */}
      <td className="px-4 py-3">
        <div className="font-mono text-orange-400 text-xs font-semibold">{order.tracking_code}</div>
        {order.customer && <div className="text-slate-400 text-xs mt-0.5">{order.customer.full_name}</div>}
      </td>

      {/* Addresses */}
      <td className="px-4 py-3 max-w-[180px]">
        <div className="text-slate-300 text-xs truncate">📍 {order.pickup_address}</div>
        <div className="text-slate-400 text-xs truncate mt-0.5">🏁 {order.dropoff_address}</div>
      </td>

      {/* Vehicle */}
      <td className="px-4 py-3 text-center text-lg">
        {VEHICLE_ICONS[order.vehicle_type] || '🚗'}
      </td>

      {/* Price */}
      <td className="px-4 py-3 text-white font-semibold whitespace-nowrap">
        {formatPrice(order.total_price)}
      </td>

      {/* Status inline dropdown */}
      <td className="px-4 py-3">
        {isDone ? (
          <Badge className={`border text-xs ${ORDER_STATUS_COLORS[status]}`}>
            {STATUS_OPTIONS.find(s => s.value === status)?.label || status}
          </Badge>
        ) : (
          <div className="relative">
            {loading && <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-orange-400 animate-spin z-10" />}
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={loading || cancelled}
              className="w-full bg-[#0a1628] border border-[#1e4976]/60 text-white text-xs rounded-lg px-2 py-1.5 pr-6 appearance-none cursor-pointer focus:outline-none focus:border-orange-500 disabled:opacity-50"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        )}
      </td>

      {/* Courier inline dropdown */}
      <td className="px-4 py-3 min-w-[160px]">
        {isDone ? (
          <span className="text-slate-500 text-xs">
            {order.courier
              ? `${VEHICLE_ICONS[order.courier.vehicle_type] || ''} ${order.courier.vehicle_plate}`
              : '—'}
          </span>
        ) : (
          ACTIVE_STATUSES.includes(status) ? (
            <select
              value={courierId}
              onChange={(e) => handleCourierChange(e.target.value)}
              disabled={loading || cancelled}
              className="w-full bg-[#0a1628] border border-[#1e4976]/60 text-white text-xs rounded-lg px-2 py-1.5 appearance-none cursor-pointer focus:outline-none focus:border-orange-500 disabled:opacity-50"
            >
              <option value="">— Atanmamış —</option>
              {couriers.map(c => (
                <option key={c.id} value={c.id}>
                  {VEHICLE_ICONS[c.vehicle_type] || '🚗'} {c.full_name} · {c.vehicle_plate}
                </option>
              ))}
            </select>
          ) : <span className="text-slate-600 text-xs">—</span>
        )}
      </td>

      {/* Proof photos/signatures */}
      <td className="px-4 py-3 min-w-[150px]">
        <div className="flex flex-wrap gap-1.5">
          <ProofLink href={order.pickup_photo_url} label="Alım Foto" />
          <ProofLink href={order.delivery_photo_url} label="Teslim Foto" />
          <ProofLink href={order.pickup_signature_url} label="Alım İmza" />
          <ProofLink href={order.delivery_signature_url} label="Teslim İmza" />
          {!order.pickup_photo_url && !order.delivery_photo_url && !order.pickup_signature_url && !order.delivery_signature_url && (
            <span className="text-xs text-slate-600">Yok</span>
          )}
        </div>
      </td>

      {/* Cancel */}
      <td className="px-4 py-3">
        {!isDone && (
          <button
            onClick={handleCancel}
            disabled={cancelling || loading}
            title="Siparişi İptal Et"
            className="flex items-center gap-1 text-xs text-red-500 hover:text-white hover:bg-red-600 border border-red-500/40 hover:border-red-600 px-2 py-1 rounded-lg transition-all disabled:opacity-40"
          >
            {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
            İptal
          </button>
        )}
      </td>
    </tr>
  );
}
