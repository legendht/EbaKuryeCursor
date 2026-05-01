'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/pricing';

interface Props { customerId: string; currentBalance: number; }

export default function AdminAccountActions({ customerId, currentBalance }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'payment' | 'debit' | 'credit' | 'refund'>('payment');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error('Geçerli tutar girin'); return; }
    setLoading(true);

    const balanceDelta = ['payment', 'credit', 'refund'].includes(type) ? amt : -amt;
    const newBalance = currentBalance + balanceDelta;

    const { error } = await supabase.from('account_transactions').insert({
      customer_id: customerId,
      type,
      amount: amt,
      description: description || null,
      balance_after: newBalance,
    });

    if (!error) {
      await supabase.from('customer_accounts')
        .update({ balance: newBalance })
        .eq('customer_id', customerId);

      toast.success('İşlem kaydedildi');
      setOpen(false);
      setAmount('');
      setDescription('');
      router.refresh();
    } else {
      toast.error('İşlem başarısız');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <span className="text-xs text-slate-400 hover:text-orange-400 cursor-pointer px-2 py-1">Hesap</span>
      </DialogTrigger>
      <DialogContent className="bg-[#0f2340] border-[#1e4976]/60 text-white">
        <DialogHeader>
          <DialogTitle>Cari Hesap İşlemi</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">Mevcut Bakiye: <span className={`font-bold ${currentBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPrice(currentBalance)}</span></p>
          <div className="space-y-2">
            <Label className="text-slate-300">İşlem Türü</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="bg-[#0a1628] border-[#1e4976]/60 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0f2340] border-[#1e4976]/60">
                <SelectItem value="payment" className="text-slate-300 focus:bg-[#1e4976]/40">💚 Ödeme Alındı</SelectItem>
                <SelectItem value="credit" className="text-slate-300 focus:bg-[#1e4976]/40">➕ Alacak Ekle</SelectItem>
                <SelectItem value="debit" className="text-slate-300 focus:bg-[#1e4976]/40">➖ Borç Ekle</SelectItem>
                <SelectItem value="refund" className="text-slate-300 focus:bg-[#1e4976]/40">🔄 İade</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Tutar (₺)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="bg-[#0a1628] border-[#1e4976]/60 text-white" placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Açıklama (isteğe bağlı)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)}
              className="bg-[#0a1628] border-[#1e4976]/60 text-white" placeholder="İşlem açıklaması..." />
          </div>
          <Button onClick={handleSubmit} disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white">
            {loading ? 'Kaydediliyor...' : 'İşlemi Kaydet'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
