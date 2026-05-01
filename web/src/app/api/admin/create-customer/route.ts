import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const admin = await createAdminClient();
    const body = await req.json();
    const { full_name, email, password, phone, company_name, tax_number, is_b2b, address } = body;

    if (!full_name || !email || !password) {
      return NextResponse.json({ error: 'Zorunlu alanlar eksik' }, { status: 400 });
    }

    // Create auth user
    const { data: newUser, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (userError || !newUser?.user) {
      return NextResponse.json({ error: userError?.message || 'Kullanıcı oluşturulamadı' }, { status: 500 });
    }

    const userId = newUser.user.id;

    // Profile
    await admin.from('profiles').upsert({
      id: userId,
      full_name: full_name.trim(),
      phone: phone || null,
      role: 'customer',
    });

    // Customer account
    await admin.from('customer_accounts').upsert({
      customer_id: userId,
      company_name: company_name || null,
      tax_number: tax_number || null,
      is_b2b: !!is_b2b,
      balance: 0,
    });

    return NextResponse.json({ success: true, userId });
  } catch (err) {
    console.error('[create-customer]', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
