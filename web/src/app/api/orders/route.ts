import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getRouteDistance } from '@/lib/mapbox';
import { getVehicleForWeight, calculatePrice } from '@/lib/pricing';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      pickupAddress, pickupLat, pickupLng, pickupContact, pickupPhone,
      dropoffAddress, dropoffLat, dropoffLng, dropoffContact, dropoffPhone,
      weightKg, description, cargoPhotoUrl, notes,
    } = body;

    // Get pricing
    const { data: configs } = await supabase.from('pricing_config').select('*').eq('is_active', true);
    const config = getVehicleForWeight(Number(weightKg), (configs || []) as any);
    if (!config) return NextResponse.json({ error: 'No vehicle for this weight' }, { status: 400 });

    const distanceKm = await getRouteDistance([pickupLng, pickupLat], [dropoffLng, dropoffLat]);
    const totalPrice = calculatePrice(distanceKm, config as any);

    const { data: order, error } = await supabase.from('orders').insert({
      customer_id: user.id,
      pickup_address: pickupAddress,
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      pickup_contact: pickupContact || null,
      pickup_phone: pickupPhone || null,
      dropoff_address: dropoffAddress,
      dropoff_lat: dropoffLat,
      dropoff_lng: dropoffLng,
      dropoff_contact: dropoffContact || null,
      dropoff_phone: dropoffPhone || null,
      weight_kg: weightKg,
      description: description || null,
      cargo_photo_url: cargoPhotoUrl || null,
      vehicle_type: config.vehicle_type,
      distance_km: Math.round(distanceKm * 10) / 10,
      base_fare: config.base_fare,
      per_km_rate: config.per_km_rate,
      total_price: Math.ceil(totalPrice),
      notes: notes || null,
      status: 'confirmed',
    }).select().single();

    if (error) throw error;

    // Auto-assign nearest available courier
    const adminClient = await createAdminClient();
    const { data: couriers } = await adminClient
      .from('couriers')
      .select('id, current_lat, current_lng, vehicle_type')
      .eq('status', 'online')
      .eq('vehicle_type', config.vehicle_type)
      .eq('is_approved', true);

    if (couriers?.length) {
      // Find nearest by Euclidean distance
      let nearest = couriers[0];
      let minDist = Infinity;
      for (const c of couriers) {
        if (!c.current_lat || !c.current_lng) continue;
        const d = Math.hypot(c.current_lat - pickupLat, c.current_lng - pickupLng);
        if (d < minDist) { minDist = d; nearest = c; }
      }

      await adminClient.from('orders').update({ courier_id: nearest.id, status: 'assigned' }).eq('id', order.id);
      await adminClient.from('couriers').update({ status: 'busy' }).eq('id', nearest.id);

      // Notify via socket
      try {
        await fetch(`${process.env.SOCKET_INTERNAL_URL}/emit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'courier:new:job',
            room: `courier:${nearest.id}`,
            data: { orderId: order.id, trackingCode: order.tracking_code },
          }),
        });
      } catch {}
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    console.error('[orders POST]', err);
    return NextResponse.json({ error: 'Order creation failed' }, { status: 500 });
  }
}
