'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <Button
      onClick={handleLogout}
      variant="ghost"
      size="sm"
      className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 gap-1 border border-slate-700/50"
    >
      <LogOut className="w-4 h-4" />
      Çıkış Yap
    </Button>
  );
}
