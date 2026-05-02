import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { haversineDistance } from '@/lib/mapbox';
import { getVehicleForWeight, calculatePrice } from '@/lib/pricing';

async function emitSocket(room: string, event: string, data: Record<string, unknown>) {
  const url = process.env.SOCKET_INTERNAL_URL;
  if (!url) return;
  try {
    await fetch(`${url}/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, event, data }),
    });
  } catch (err) {
    console.error('[socket emit]', err);
  }
}

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

    // Get pricing from DB
    const { data: configs } = await supabase.from('pricing_config').select('*').eq('is_active', true);
    const config = getVehicleForWeight(Number(weightKg), (configs || []) as never);

    // Fallback pricing if DB unavailable
    const FALLBACK = [
      { vehicle_type: 'motorcycle', base_fare: 150, per_km_rate: 10, min_weight_kg: 0,  max_weight_kg: 10 },
      { vehicle_type: 'car',        base_fare: 250, per_km_rate: 15, min_weight_kg: 10, max_weight_kg: 75 },
      { vehicle_type: 'van',        base_fare: 350, per_km_rate: 20, min_weight_kg: 75, max_weight_kg: 1000 },
    ];
    const pricingConfig = config || FALLBACK.find(p => weightKg >= p.min_weight_kg && weightKg <= p.max_weight_kg);
    if (!pricingConfig) return NextResponse.json({ error: 'No vehicle for this weight' }, { status: 400 });

    // Distance with haversine fallback
    let distanceKm = haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    try {
      const { getRouteDistance } = await import('@/lib/mapbox');
      distanceKm = await getRouteDistance([pickupLng, pickupLat], [dropoffLng, dropoffLat]);
    } catch {}

    const rawTotal = calculatePrice(distanceKm, pricingConfig as never);

    // Müşteri indirim oranı (varsa)
    const { data: account } = await supabase
      .from('customer_accounts')
      .select('balance, discount_rate')
      .eq('customer_id', user.id)
      .maybeSingle();

    const discountRate = Number(account?.discount_rate ?? 0);
    const discountAmount = discountRate > 0 ? (rawTotal * discountRate) / 100 : 0;
    const totalPrice = Math.ceil(rawTotal - discountAmount);

    const { data: order, error } = await supabase.from('orders').insert({
      customer_id: user.id,
      pickup_address: pickupAddress, pickup_lat: pickupLat, pickup_lng: pickupLng,
      pickup_contact: pickupContact || null, pickup_phone: pickupPhone || null,
      dropoff_address: dropoffAddress, dropoff_lat: dropoffLat, dropoff_lng: dropoffLng,
      dropoff_contact: dropoffContact || null, dropoff_phone: dropoffPhone || null,
      weight_kg: weightKg, description: description || null,
      cargo_photo_url: cargoPhotoUrl || null,
      vehicle_type: pricingConfig.vehicle_type,
      distance_km: Math.round(distanceKm * 10) / 10,
      base_fare: pricingConfig.base_fare,
      per_km_rate: pricingConfig.per_km_rate,
      total_price: totalPrice,
      discount_amount: Math.round(discountAmount * 100) / 100,
      notes: notes || null,
      status: 'confirmed',
    }).select().single();

    if (error) throw error;

    // Müşterinin bakiyesi yeterliyse otomatik düş
    let paidFromBalance = false;
    if (account && Number(account.balance) >= totalPrice) {
      try {
        const { data: chargeRes } = await supabase.rpc('charge_customer_balance' as never, {
          p_order_id: order.id,
        });
        if (chargeRes && (chargeRes as { charged: boolean }).charged) {
          paidFromBalance = true;
          order.paid_from_balance = true;
        }
      } catch (chargeErr) {
        console.error('[charge_customer_balance]', chargeErr);
      }
    }

    // Auto-assign nearest courier via SECURITY DEFINER function
    let assignResult: { assigned: boolean; courier_id?: string; courier_name?: string } = { assigned: false };
    try {
      const { data } = await supabase.rpc('assign_nearest_courier' as never, {
        p_order_id: order.id,
        p_vehicle_type: pricingConfig.vehicle_type,
        p_pickup_lat: pickupLat,
        p_pickup_lng: pickupLng,
      });
      if (data) assignResult = data as typeof assignResult;
    } catch (assignErr) {
      console.error('[assign_nearest_courier]', assignErr);
    }

    if (assignResult.assigned && assignResult.courier_id) {
      await emitSocket(`courier:${assignResult.courier_id}`, 'courier:new:job', {
        orderId: order.id,
        trackingCode: order.tracking_code,
        paidFromBalance,
      });
    }

    return NextResponse.json({
      order: { ...order, assigned: assignResult.assigned, courier_name: assignResult.courier_name, paid_from_balance: paidFromBalance },
    }, { status: 201 });
  } catch (err) {
    console.error('[orders POST]', err);
    return NextResponse.json({ error: 'Order creation failed' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ orders });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
