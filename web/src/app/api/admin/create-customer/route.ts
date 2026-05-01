import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { full_name, email, password, phone, company_name, tax_number, is_b2b, address } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('admin_create_user', {
    p_email: email,
    p_password: password,
    p_full_name: full_name,
    p_phone: phone || null,
    p_role: 'customer',
    p_company_name: company_name || null,
    p_tax_number: tax_number || null,
    p_is_b2b: !!is_b2b,
    p_address: address || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, userId: data });
}
