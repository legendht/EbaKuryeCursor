'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types/database';
import { ORDER_STATUS_LABELS } from '@/lib/pricing';
import { Loader2 } from 'lucide-react';

interface Props { order: Order & { customer?: { full_name: string }; courier?: { vehicle_type: string; vehicle_plate: string } } }

const STATUSES = ['pending', 'confirmed', 'assigning', 'assigned', 'pickup', 'in_transit', 'delivered', 'cancelled', 'failed'];
const VEHICLE_ICONS: Record<string, string> = { motorcycle: '🏍️', car: '🚗', van: '🚐' };

export default function AdminOrderActions({ order }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(order.status);
  const [selectedCourier, setSelectedCourier] = useState(order.courier_id || '');
  const [couriers, setCouriers] = useState<{ id: string; vehicle_type: string; vehicle_plate: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [couriersLoading, setCouriersLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (!open) return;
    const loadCouriers = async () => {
      setCouriersLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('couriers')
        .select('id, vehicle_type, vehicle_plate, profile:profiles(full_name)')
        .eq('is_approved', true)
        .in('status', ['online', 'busy', 'offline'])
        .order('status');
      setCouriers(
        (data || []).map((c: { id: string; vehicle_type: string; vehicle_plate: string; profile?: { full_name?: string } }) => ({
          id: c.id,
          vehicle_type: c.vehicle_type,
          vehicle_plate: c.vehicle_plate,
          full_name: c.profile?.full_name || '-',
        }))
      );
      setCouriersLoading(false);
    };
    loadCouriers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleUpdate = async () => {
    setLoading(true);
    const body: Record<string, unknown> = { status };
    if (selectedCourier && selectedCourier !== order.courier_id) {
      body.courierId = selectedCourier;
      if (status !== 'assigned') body.status = 'assigned';
    }

    const res = await fetch(`/api/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      toast.success('Sipariş güncellendi');
      setOpen(false);
      window.location.reload();
    } else {
      const d = await res.json();
      toast.error(d.error || 'Güncelleme başarısız');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <span className="text-xs text-slate-400 hover:text-orange-400 cursor-pointer px-2 py-1">Düzenle</span>
      </DialogTrigger>
      <DialogContent className="bg-[#0f2340] border-[#1e4976]/60 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Sipariş Yönet</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Order info */}
          <div className="bg-[#0a1628] rounded-lg p-3 text-xs space-y-1 border border-[#1e4976]/30">
            <div className="flex gap-2"><span className="text-slate-500">Takip:</span><span className="text-orange-400 font-mono">{order.tracking_code}</span></div>
            <div className="flex gap-2"><span className="text-slate-500">Alım:</span><span className="text-slate-300 truncate">{order.pickup_address}</span></div>
            <div className="flex gap-2"><span className="text-slate-500">Teslimat:</span><span className="text-slate-300 truncate">{order.dropoff_address}</span></div>
            {order.customer && <div className="flex gap-2"><span className="text-slate-500">Müşteri:</span><span className="text-slate-300">{order.customer.full_name}</span></div>}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-slate-300 text-sm font-medium">Durum</label>
            <Select value={status} onValueChange={(v) => setStatus(v as Order['status'])}>
              <SelectTrigger className="bg-[#0a1628] border-[#1e4976]/60 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0f2340] border-[#1e4976]/60">
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-slate-300 focus:bg-[#1e4976]/40">
                    {ORDER_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Manual Courier Assignment */}
          <div className="space-y-2">
            <label className="text-slate-300 text-sm font-medium">Manuel Kurye Ata</label>
            {couriersLoading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Kuryeler yükleniyor...
              </div>
            ) : (
              <Select value={selectedCourier} onValueChange={setSelectedCourier}>
                <SelectTrigger className="bg-[#0a1628] border-[#1e4976]/60 text-white">
                  <SelectValue placeholder="Kurye seçin..." />
                </SelectTrigger>
                <SelectContent className="bg-[#0f2340] border-[#1e4976]/60">
                  <SelectItem value="" className="text-slate-500 focus:bg-[#1e4976]/40">— Atanmamış —</SelectItem>
                  {couriers.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-slate-300 focus:bg-[#1e4976]/40">
                      {VEHICLE_ICONS[c.vehicle_type] || '🚗'} {c.full_name} — {c.vehicle_plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedCourier && selectedCourier !== order.courier_id && (
              <p className="text-xs text-orange-400">Kaydet'e basınca kurye atanır ve bildirim gönderilir.</p>
            )}
          </div>

          <Button onClick={handleUpdate} disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kaydet'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
