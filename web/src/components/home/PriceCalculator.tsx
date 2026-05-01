'use client';

import { useState, useCallback, useEffect } from 'react';
import { MapPin, ArrowRight, Loader2, Weight, MessageCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { geocodeAddress, type GeocodingFeature, MAPBOX_TOKEN } from '@/lib/mapbox';
import { formatPrice, VEHICLE_LABELS, VEHICLE_ICONS } from '@/lib/pricing';

// Fallback pricing (matches DB values)
const FALLBACK_PRICING = [
  { vehicle_type: 'motorcycle', base_fare: 150, per_km_rate: 10, min_weight_kg: 0,  max_weight_kg: 10,   is_active: true },
  { vehicle_type: 'car',        base_fare: 250, per_km_rate: 15, min_weight_kg: 10, max_weight_kg: 75,   is_active: true },
  { vehicle_type: 'van',        base_fare: 350, per_km_rate: 20, min_weight_kg: 75, max_weight_kg: 1000, is_active: true },
];

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.35;
}

async function getClientDistance(fromLng: number, fromLat: number, toLng: number, toLat: number): Promise<number> {
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${toLng},${toLat}?access_token=${MAPBOX_TOKEN}&overview=simplified`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('mapbox error');
    const data = await res.json();
    const dist = data.routes?.[0]?.distance;
    if (dist) return dist / 1000;
  } catch {}
  return haversine(fromLat, fromLng, toLat, toLng);
}

function AddressInput({ label, icon, value, onChange, onSelect, placeholder }: {
  label: string; icon: React.ReactNode; value: string;
  onChange: (val: string) => void; onSelect: (feature: GeocodingFeature) => void; placeholder: string;
}) {
  const [results, setResults] = useState<GeocodingFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setResults([]); return; }
    setLoading(true);
    const data = await geocodeAddress(q);
    setResults(data);
    setOpen(data.length > 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selected) { setSelected(false); return; }
    const timer = setTimeout(() => search(value), 350);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, search]);

  return (
    <div className="space-y-1 relative">
      <Label className="text-slate-300 text-sm">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        <Input
          className="pl-9 pr-8 bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500"
          placeholder={placeholder}
          value={value}
          onChange={(e) => { onChange(e.target.value); }}
          onFocus={() => results.length > 0 && !selected && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          autoComplete="off"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}
        {selected && !loading && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#0f2340] border border-[#1e4976]/60 rounded-lg shadow-2xl overflow-hidden">
          {results.map((feat) => (
            <button
              key={feat.id}
              type="button"
              className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-[#1e4976]/50 transition-colors border-b border-[#1e4976]/30 last:border-0"
              onMouseDown={() => {
                onChange(feat.place_name);   // önce text güncelle
                onSelect(feat);              // sonra lat/lng set et (son çağrı kazanır)
                setSelected(true);
                setOpen(false);
              }}
            >
              <span className="font-medium">{feat.text}</span>
              <span className="text-slate-400 ml-2 text-xs">{feat.place_name.split(',').slice(1, 3).join(',').trim()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface PriceCalculatorProps {
  whatsapp?: string;
}

export default function PriceCalculator({ whatsapp = '905XXXXXXXXX' }: PriceCalculatorProps) {
  const router = useRouter();
  const [pickup, setPickup]   = useState({ text: '', lat: 0, lng: 0 });
  const [dropoff, setDropoff] = useState({ text: '', lat: 0, lng: 0 });
  const [weight, setWeight]   = useState('1');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{
    vehicle_type: string; distance_km: number; total_price: number;
    base_fare: number; per_km_rate: number;
  } | null>(null);

  const calculate = useCallback(async (pu: typeof pickup, do_: typeof dropoff, w: string) => {
    if (!pu.lat || !do_.lat) return;
    const kg = parseFloat(w);
    if (isNaN(kg) || kg <= 0) return;

    setLoading(true);
    setResult(null);

    // 1. Try server API (handles both Mapbox + DB pricing)
    try {
      const res = await fetch('/api/pricing/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupLng: pu.lng, pickupLat: pu.lat, dropoffLng: do_.lng, dropoffLat: do_.lat, weightKg: kg }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.total_price !== undefined) {
          setResult(data);
          setLoading(false);
          return;
        }
      }
    } catch {}

    // 2. Full client-side fallback (Mapbox or haversine + hardcoded pricing)
    const distKm = await getClientDistance(pu.lng, pu.lat, do_.lng, do_.lat);
    const config = FALLBACK_PRICING.find(p => p.is_active && kg >= p.min_weight_kg && kg <= p.max_weight_kg);
    if (config) {
      setResult({
        vehicle_type: config.vehicle_type,
        distance_km: Math.round(distKm * 10) / 10,
        base_fare: config.base_fare,
        per_km_rate: config.per_km_rate,
        total_price: Math.ceil(config.base_fare + distKm * config.per_km_rate),
      });
    }
    setLoading(false);
  }, []);

  // Auto-trigger
  useEffect(() => {
    if (pickup.lat && dropoff.lat) {
      const t = setTimeout(() => calculate(pickup, dropoff, weight), 400);
      return () => clearTimeout(t);
    }
  }, [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng, weight, calculate]);

  const handleOrder = () => {
    const params = new URLSearchParams({
      pickupAddress: pickup.text,  pickupLat: String(pickup.lat),  pickupLng: String(pickup.lng),
      dropoffAddress: dropoff.text, dropoffLat: String(dropoff.lat), dropoffLng: String(dropoff.lng),
      weightKg: weight,
    });
    router.push(`/new-order?${params.toString()}`);
  };

  const whatsappUrl = `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
    `Merhaba, özel fiyat almak istiyorum.\n\n📍 Alım: ${pickup.text || '...'}\n🏁 Teslimat: ${dropoff.text || '...'}\n⚖️ Ağırlık: ${weight} kg${result ? `\n💰 Hesaplanan fiyat: ${formatPrice(result.total_price)}` : ''}`
  )}`;

  return (
    <div className="glass-card rounded-2xl p-6 space-y-5 shadow-2xl">
      <div>
        <h2 className="text-xl font-bold text-white">Anında Fiyat Al</h2>
        <p className="text-slate-400 text-sm mt-1">Canlı İstanbul trafiğine göre hesaplama</p>
      </div>

      <AddressInput
        label="Nereden"
        icon={<MapPin className="w-4 h-4" />}
        value={pickup.text}
        onChange={(val) => setPickup({ text: val, lat: 0, lng: 0 })}
        onSelect={(f) => setPickup({ text: f.place_name, lat: f.center[1], lng: f.center[0] })}
        placeholder="Alım adresi seçin..."
      />

      <div className="flex justify-center">
        <div className="w-8 h-8 rounded-full border border-[#1e4976]/60 flex items-center justify-center bg-[#0f2340]">
          <ArrowRight className="w-4 h-4 text-orange-500" />
        </div>
      </div>

      <AddressInput
        label="Nereye"
        icon={<MapPin className="w-4 h-4 text-orange-500" />}
        value={dropoff.text}
        onChange={(val) => setDropoff({ text: val, lat: 0, lng: 0 })}
        onSelect={(f) => setDropoff({ text: f.place_name, lat: f.center[1], lng: f.center[0] })}
        placeholder="Teslimat adresi seçin..."
      />

      <div className="space-y-1">
        <Label className="text-slate-300 text-sm">Kargo Ağırlığı (kg)</Label>
        <div className="relative">
          <Weight className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="number" min="0.1" step="0.1"
            className="pl-9 bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <p className="text-xs text-slate-500">0-10kg: Moto &nbsp;·&nbsp; 10-75kg: Oto &nbsp;·&nbsp; 75kg+: Kamyonet</p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-4">
          <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
          <span className="text-slate-400 text-sm">Fiyat hesaplanıyor...</span>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="bg-[#0a1628] border border-orange-500/30 rounded-xl p-4 space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{VEHICLE_ICONS[result.vehicle_type as keyof typeof VEHICLE_ICONS]}</span>
              <span className="text-slate-300 font-medium">{VEHICLE_LABELS[result.vehicle_type as keyof typeof VEHICLE_LABELS]}</span>
            </div>
            <span className="text-orange-500 font-bold text-sm">{result.distance_km.toFixed(1)} km</span>
          </div>
          <div className="text-xs text-slate-500 space-y-1">
            <div className="flex justify-between"><span>Açılış Ücreti</span><span>{formatPrice(result.base_fare)}</span></div>
            <div className="flex justify-between">
              <span>{result.distance_km.toFixed(1)} km × {formatPrice(result.per_km_rate)}/km</span>
              <span>{formatPrice(result.distance_km * result.per_km_rate)}</span>
            </div>
          </div>
          <div className="border-t border-[#1e4976]/40 pt-2 flex items-center justify-between">
            <span className="text-slate-300 font-semibold">Toplam</span>
            <span className="text-2xl font-bold text-orange-500">{formatPrice(result.total_price)}</span>
          </div>
          <Button onClick={handleOrder} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold btn-orange-glow text-base py-5">
            🏍️ Hemen Kurye Çağır <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {/* WhatsApp special price button — always visible */}
      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-green-900/30 hover:shadow-green-700/40 hover:scale-[1.01]"
        >
          <MessageCircle className="w-5 h-5 flex-shrink-0" />
          Özel Fiyat Al — WhatsApp
        </button>
      </a>

      {(!pickup.lat || !dropoff.lat) && !loading && (
        <p className="text-center text-slate-600 text-xs">
          Adres seçildiğinde fiyat otomatik hesaplanır
        </p>
      )}
    </div>
  );
}
