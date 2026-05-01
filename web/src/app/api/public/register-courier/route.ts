import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { full_name, email, password, phone, vehicle_type, vehicle_plate, tc_no } = body;

    if (!full_name || !email || !password || !vehicle_type) {
      return NextResponse.json({ error: 'Zorunlu alanlar eksik' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Şifre en az 6 karakter olmalı' }, { status: 400 });
    }

    const admin = await createAdminClient();

    // Check if email already registered
    const { data: existing } = await admin.auth.admin.listUsers();
    const alreadyExists = existing?.users?.some((u) => u.email === email);
    if (alreadyExists) {
      return NextResponse.json({ error: 'Bu e-posta adresi zaten kayıtlı' }, { status: 400 });
    }

    // Create auth user (email confirmed = true so no confirmation email sent)
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

    // Create profile
    await admin.from('profiles').upsert({
      id: userId,
      full_name: full_name.trim(),
      phone: phone?.trim() || null,
      role: 'courier',
    });

    // Create courier record (not approved)
    const { error: courierErr } = await admin.from('couriers').upsert({
      id: userId,
      vehicle_type: vehicle_type as 'motorcycle' | 'car' | 'van',
      vehicle_plate: vehicle_plate?.trim().toUpperCase() || null,
      tc_no: tc_no?.trim() || null,
      is_approved: false,
      status: 'offline',
    });

    if (courierErr) {
      // Rollback auth user if courier insert fails
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: courierErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[register-courier]', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
