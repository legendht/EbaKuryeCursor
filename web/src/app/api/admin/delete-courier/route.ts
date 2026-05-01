import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function DELETE(req: NextRequest) {
  try {
    const { courierId } = await req.json();
    if (!courierId) return NextResponse.json({ error: 'courierId required' }, { status: 400 });

    const admin = await createAdminClient();

    // Delete auth user (cascades to profiles via trigger/FK)
    const { error: authErr } = await admin.auth.admin.deleteUser(courierId);
    if (authErr) {
      // Fallback: delete from profiles (cascades to couriers via FK)
      const { error } = await admin.from('profiles').delete().eq('id', courierId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
