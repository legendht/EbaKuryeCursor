import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  let role = profile?.role ?? null;
  if (!role) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r } = await (supabase as any).rpc('get_my_role');
    role = (r as string | null) ?? null;
  }

  if (role !== 'admin') redirect('/dashboard');

  return (
    <div className="flex min-h-screen bg-[#0a1628]">
      <AdminSidebar />
      <main className="flex-1 ml-64 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
