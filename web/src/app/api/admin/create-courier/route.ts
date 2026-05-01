import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { full_name, email, password, phone, tc_no, home_address,
          vehicle_type, vehicle_plate, vehicle_model, license_number } = body;

  // SECURITY DEFINER fonksiyonu — service role gerekmez
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('admin_create_user', {
    p_email: email,
    p_password: password,
    p_full_name: full_name,
    p_phone: phone || null,
    p_role: 'courier',
    p_tc_no: tc_no || null,
    p_home_address: home_address || null,
    p_vehicle_type: vehicle_type || 'motorcycle',
    p_vehicle_plate: vehicle_plate || null,
    p_vehicle_model: vehicle_model || null,
    p_license_number: license_number || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userId = data as string;

  // Couriers tablosuna kayıt (SECURITY DEFINER)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: courierErr } = await (supabase as any).rpc('admin_add_courier', {
    p_user_id: userId,
    p_vehicle_type: vehicle_type || 'motorcycle',
    p_vehicle_plate: vehicle_plate || null,
    p_vehicle_model: vehicle_model || null,
    p_tc_no: tc_no || null,
    p_home_address: home_address || null,
    p_license_number: license_number || null,
  });
  if (courierErr) console.error('Courier insert:', courierErr.message);

  return NextResponse.json({ success: true, courierId: userId });
}
