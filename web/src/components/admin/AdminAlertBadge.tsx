'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminAlertBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: n } = await (supabase as any)
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'admin_alert')
        .eq('is_read', false);
      setCount(n || 0);
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!count) return null;
  return (
    <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
      {count > 99 ? '99+' : count}
    </span>
  );
}
