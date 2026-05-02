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

    const rawTotal = calculatePrice(distanceKm, config as any);

    // Giriş yapmış kullanıcı varsa indirim uygula
    let discountRate = 0;
    let balance = 0;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: acct } = await supabase
          .from('customer_accounts')
          .select('balance, discount_rate')
          .eq('customer_id', user.id)
          .maybeSingle();
        if (acct) {
          discountRate = Number(acct.discount_rate ?? 0);
          balance = Number(acct.balance ?? 0);
        }
      }
    } catch {}

    const discountAmount = discountRate > 0 ? (rawTotal * discountRate) / 100 : 0;
    const totalPrice = Math.ceil(rawTotal - discountAmount);

    return NextResponse.json({
      vehicle_type: config.vehicle_type,
      distance_km: Math.round(distanceKm * 10) / 10,
      base_fare: config.base_fare,
      per_km_rate: config.per_km_rate,
      raw_total: Math.ceil(rawTotal),
      discount_rate: discountRate,
      discount_amount: Math.round(discountAmount * 100) / 100,
      total_price: totalPrice,
      balance,
      will_pay_from_balance: balance >= totalPrice && balance > 0,
    });
  } catch (err) {
    console.error('[pricing/calculate]', err);
    return NextResponse.json({ error: 'Calculation failed' }, { status: 500 });
  }
}
