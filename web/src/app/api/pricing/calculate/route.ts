import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRouteDistance, haversineDistance } from '@/lib/mapbox';
import { getVehicleForWeight, calculatePrice } from '@/lib/pricing';

export async function POST(req: NextRequest) {
  try {
    const { pickupLng, pickupLat, dropoffLng, dropoffLat, weightKg } = await req.json();

    if (!pickupLng || !pickupLat || !dropoffLng || !dropoffLat || !weightKg) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: configs } = await supabase
      .from('pricing_config')
      .select('*')
      .eq('is_active', true);

    if (!configs?.length) {
      return NextResponse.json({ error: 'Pricing not configured' }, { status: 500 });
    }

    const config = getVehicleForWeight(Number(weightKg), configs as any);
    if (!config) {
      return NextResponse.json({ error: 'No vehicle available for this weight' }, { status: 400 });
    }

    let distanceKm: number;
    try {
      distanceKm = await getRouteDistance([pickupLng, pickupLat], [dropoffLng, dropoffLat]);
    } catch {
      distanceKm = haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    }

    const totalPrice = calculatePrice(distanceKm, config as any);

    return NextResponse.json({
      vehicle_type: config.vehicle_type,
      distance_km: Math.round(distanceKm * 10) / 10,
      base_fare: config.base_fare,
      per_km_rate: config.per_km_rate,
      total_price: Math.ceil(totalPrice),
    });
  } catch (err) {
    console.error('[pricing/calculate]', err);
    return NextResponse.json({ error: 'Calculation failed' }, { status: 500 });
  }
}
