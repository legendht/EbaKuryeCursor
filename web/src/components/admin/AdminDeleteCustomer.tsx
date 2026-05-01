'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function AdminDeleteCustomer({ customerId, fullName }: { customerId: string; fullName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/delete-customer', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId }),
    });
    if (res.ok) {
      toast.success('Müşteri silindi');
      setOpen(false);
      window.location.reload();
    } else {
      const d = await res.json();
      toast.error(d.error || 'Silme başarısız');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <span className="text-xs text-red-500 hover:text-red-400 cursor-pointer px-1 py-1">Sil</span>
      </DialogTrigger>
      <DialogContent className="bg-[#0f2340] border-red-500/40 text-white">
        <DialogHeader>
          <DialogTitle>Müşteriyi Sil</DialogTitle>
        </DialogHeader>
        <p className="text-slate-400 text-sm py-2">
          <span className="text-white font-semibold">{fullName}</span> adlı müşteri kalıcı olarak silinecek. Emin misiniz?
        </p>
        <div className="flex gap-3">
          <Button onClick={() => setOpen(false)} variant="outline"
            className="flex-1 border-[#1e4976]/60 text-slate-300 hover:bg-[#1e4976]/20">İptal</Button>
          <Button onClick={handleDelete} disabled={loading}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white">
            {loading ? 'Siliniyor...' : 'Evet, Sil'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
