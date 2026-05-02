'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/pricing';

interface Props {
  customerId: string;
  currentBalance: number;
  currentDiscountRate: number;
}

export default function AdminCustomerAccountForm({ customerId, currentBalance, currentDiscountRate }: Props) {
  const [delta, setDelta] = useState('');
  const [discount, setDiscount] = useState(String(currentDiscountRate ?? 0));
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const submit = async () => {
    const numDelta = delta ? parseFloat(delta) : null;
    const numDiscount = parseFloat(discount);

    if (delta && (numDelta === null || isNaN(numDelta))) {
      toast.error('Geçerli bir bakiye hareketi girin');
      return;
    }
    if (isNaN(numDiscount) || numDiscount < 0 || numDiscount > 100) {
      toast.error('İndirim oranı 0-100 arası olmalı');
      return;
    }

    setLoading(true);
    const { error } = await supabase.rpc('admin_update_customer_account', {
      p_customer_id: customerId,
      p_delta: numDelta,
      p_new_discount_rate: numDiscount !== currentDiscountRate ? numDiscount : null,
      p_description: description || null,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Güncellendi');
    setDelta('');
    setDescription('');
    router.refresh();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label className="text-slate-300">Bakiye Hareketi (₺)</Label>
        <Input
          type="number" step="0.01"
          value={delta} onChange={(e) => setDelta(e.target.value)}
          placeholder="Örn: 500 (yükleme) veya -50 (düşme)"
          className="bg-[#0a1628] border-[#1e4976]/60 text-white"
        />
        <p className="text-slate-500 text-xs">
          Mevcut: <span className="text-green-400 font-semibold">{formatPrice(currentBalance)}</span>.
          Pozitif sayı ekler, negatif düşer.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Özel İndirim Oranı (%)</Label>
        <Input
          type="number" step="0.1" min="0" max="100"
          value={discount} onChange={(e) => setDiscount(e.target.value)}
          className="bg-[#0a1628] border-[#1e4976]/60 text-white"
        />
        <p className="text-slate-500 text-xs">
          Her siparişinde bu oran kadar indirim uygulanır (0-100).
        </p>
      </div>

      <div className="md:col-span-2 space-y-2">
        <Label className="text-slate-300">Açıklama</Label>
        <Input
          value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Örn: Nakit ödeme alındı, manuel düzeltme..."
          className="bg-[#0a1628] border-[#1e4976]/60 text-white"
        />
      </div>

      <div className="md:col-span-2">
        <Button onClick={submit} disabled={loading}
          className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 text-white">
          {loading ? 'Kaydediliyor...' : 'Kaydet'}
        </Button>
      </div>
    </div>
  );
}
