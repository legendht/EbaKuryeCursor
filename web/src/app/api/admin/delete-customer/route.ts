import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(req: NextRequest) {
  try {
    const { customerId } = await req.json();
    if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

    const supabase = await createClient();

    const { data: role } = await supabase.rpc('get_my_role' as never);
    if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Delete profile (cascades to customer_accounts via FK)
    const { error } = await supabase.from('profiles').delete().eq('id', customerId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
