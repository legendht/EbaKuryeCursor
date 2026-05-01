'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { Order } from '@/types/database';
import { ORDER_STATUS_LABELS } from '@/lib/pricing';

interface Props { order: Order; }

const STATUSES = ['pending', 'confirmed', 'assigning', 'assigned', 'pickup', 'in_transit', 'delivered', 'cancelled', 'failed'];

export default function AdminOrderActions({ order }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(order.status);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleUpdate = async () => {
    setLoading(true);
    const res = await fetch(`/api/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success('Durum güncellendi');
      setOpen(false);
      router.refresh();
    } else {
      toast.error('Güncelleme başarısız');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <span className="text-xs text-slate-400 hover:text-orange-400 cursor-pointer px-2 py-1">Düzenle</span>
      </DialogTrigger>
      <DialogContent className="bg-[#0f2340] border-[#1e4976]/60 text-white">
        <DialogHeader>
          <DialogTitle>Sipariş Güncelle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-slate-400 text-sm font-mono">{order.tracking_code}</p>
          <div className="space-y-2">
            <label className="text-slate-300 text-sm">Durum</label>
            <Select value={status} onValueChange={(v) => setStatus(v as Order['status'])}>
              <SelectTrigger className="bg-[#0a1628] border-[#1e4976]/60 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0f2340] border-[#1e4976]/60">
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-slate-300 hover:text-white focus:bg-[#1e4976]/40">
                    {ORDER_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleUpdate} disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white">
            {loading ? 'Güncelleniyor...' : 'Güncelle'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
