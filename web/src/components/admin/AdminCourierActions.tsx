'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Courier } from '@/types/database';

export default function AdminCourierActions({ courier }: { courier: Courier }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const toggleApprove = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('couriers')
      .update({ is_approved: !courier.is_approved })
      .eq('id', courier.id);
    if (!error) {
      toast.success(courier.is_approved ? 'Onay kaldırıldı' : 'Kurye onaylandı');
      setOpen(false);
      router.refresh();
    } else {
      toast.error('İşlem başarısız');
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
          <DialogTitle>Kurye Yönetimi</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Button
            onClick={toggleApprove}
            disabled={loading}
            className={courier.is_approved ? 'w-full bg-red-500 hover:bg-red-600 text-white' : 'w-full bg-green-500 hover:bg-green-600 text-white'}
          >
            {courier.is_approved ? 'Onayı Kaldır' : 'Onayla'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
