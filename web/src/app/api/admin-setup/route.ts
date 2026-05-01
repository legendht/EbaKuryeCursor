import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  // Mevcut kullanıcıyı al
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Giriş yapın' }, { status: 401 });
  }

  // Service role ile işlem yap
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let client: any = supabase;
    try {
      client = await createAdminClient();
    } catch {}

    const { error } = await client
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', user.id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `${user.email} kullanıcısı artık admin. /admin adresine gidin.`,
      userId: user.id,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
