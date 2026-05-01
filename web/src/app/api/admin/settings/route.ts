import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const [pricing, settings] = await Promise.all([
    db.from('pricing_config').select('*').order('min_weight_kg'),
    db.from('site_settings').select('*'),
  ]);
  return NextResponse.json({
    pricing: pricing.data || [],
    settings: settings.data || [],
  });
}

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = await createAdminClient() as any;

  const body = await req.json();
  const { pricing, settings } = body;

  try {
    // Fiyat güncellemeleri
    if (pricing?.length) {
      for (const p of pricing) {
        const { error } = await db.from('pricing_config')
          .update({
            base_fare: Number(p.base_fare),
            per_km_rate: Number(p.per_km_rate),
            min_weight_kg: Number(p.min_weight_kg),
            max_weight_kg: Number(p.max_weight_kg),
          })
          .eq('id', p.id);
        if (error) throw new Error(`Pricing update error: ${error.message}`);
      }
    }

    // Ayar güncellemeleri
    if (settings?.length) {
      for (const s of settings) {
        // Önce var mı kontrol et
        const { data: existing } = await db.from('site_settings').select('key').eq('key', s.key).single();
        if (existing) {
          const { error } = await db.from('site_settings')
            .update({ value: s.value, updated_at: new Date().toISOString() })
            .eq('key', s.key);
          if (error) throw new Error(`Setting update error: ${error.message}`);
        } else {
          const { error } = await db.from('site_settings')
            .insert({ key: s.key, value: s.value });
          if (error) throw new Error(`Setting insert error: ${error.message}`);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Settings save error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Hata' }, { status: 500 });
  }
}
