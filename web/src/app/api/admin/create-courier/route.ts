import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const admin = await createAdminClient();

    const body = await req.json();
    const { full_name, email, password, phone, tc_no, home_address,
            vehicle_type, vehicle_plate, vehicle_model, license_number } = body;

    if (!full_name || !email || !password) {
      return NextResponse.json({ error: 'Ad, e-posta ve şifre zorunludur' }, { status: 400 });
    }

    // Create auth user via admin API (no confirmation email)
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

    // Profile kaydı
    const { error: profileErr } = await admin.from('profiles').upsert({
      id: userId,
      full_name: full_name.trim(),
      phone: phone || null,
      role: 'courier',
    });
    if (profileErr) console.error('Profile upsert:', profileErr.message);

    // Courier kaydı
    const { error: courierErr } = await admin.from('couriers').upsert({
      id: userId,
      vehicle_type: (vehicle_type || 'motorcycle') as 'motorcycle' | 'car' | 'van',
      vehicle_plate: vehicle_plate || null,
      vehicle_model: vehicle_model || null,
      tc_no: tc_no || null,
      home_address: home_address || null,
      license_number: license_number || null,
      is_approved: true,
      status: 'offline',
    });
    if (courierErr) console.error('Courier upsert:', courierErr.message);

    return NextResponse.json({ success: true, courierId: userId });
  } catch (err) {
    console.error('[create-courier]', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
