'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Check } from 'lucide-react';

export default function AdminMarkAlertRead({ alertId }: { alertId: string }) {
  const [done, setDone] = useState(false);

  const mark = async () => {
    const supabase = createClient();
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', alertId);
    if (!error) {
      setDone(true);
      window.location.reload();
    } else {
      toast.error('İşlem başarısız');
    }
  };

  if (done) return null;
  return (
    <button
      onClick={mark}
      className="flex items-center gap-1 text-xs text-slate-400 hover:text-green-400 border border-slate-600/40 hover:border-green-500/40 px-2 py-1 rounded-lg transition-colors flex-shrink-0"
    >
      <Check className="w-3 h-3" /> Okundu
    </button>
  );
}
