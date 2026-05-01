import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function DELETE(req: NextRequest) {
  try {
    const { customerId } = await req.json();
    if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

    const admin = await createAdminClient();

    // Delete auth user (cascades to profiles)
    const { error: authErr } = await admin.auth.admin.deleteUser(customerId);
    if (authErr) {
      const { error } = await admin.from('profiles').delete().eq('id', customerId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
