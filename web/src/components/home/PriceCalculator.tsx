'use client';

import { useState, useCallback, useEffect } from 'react';
import { MapPin, ArrowRight, Loader2, Weight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { geocodeAddress, type GeocodingFeature } from '@/lib/mapbox';
import { formatPrice, VEHICLE_LABELS, VEHICLE_ICONS } from '@/lib/pricing';
import { toast } from 'sonner';

interface AddressInputProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (val: string) => void;
  onSelect: (feature: GeocodingFeature) => void;
  placeholder: string;
}

function AddressInput({ label, icon, value, onChange, onSelect, placeholder }: AddressInputProps) {
  const [results, setResults] = useState<GeocodingFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setResults([]); return; }
    setLoading(true);
    const data = await geocodeAddress(q);
    setResults(data);
    setOpen(data.length > 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(value), 350);
    return () => clearTimeout(timer);
  }, [value, search]);

  return (
    <div className="space-y-1 relative">
      <Label className="text-slate-300 text-sm">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        <Input
          className="pl-9 bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500"
          placeholder={placeholder}
          value={value}
          onChange={(e) => { onChange(e.target.value); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#0f2340] border border-[#1e4976]/60 rounded-lg shadow-2xl overflow-hidden">
          {results.map((feat) => (
            <button
              key={feat.id}
              type="button"
              className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-[#1e4976]/50 transition-colors border-b border-[#1e4976]/30 last:border-0"
              onMouseDown={() => { onSelect(feat); onChange(feat.place_name); setOpen(false); }}
            >
              <span className="font-medium">{feat.text}</span>
              <span className="text-slate-400 ml-2 text-xs">{feat.place_name.split(',').slice(1).join(',').trim()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PriceCalculator() {
  const router = useRouter();
  const [pickup, setPickup] = useState({ text: '', lat: 0, lng: 0 });
  const [dropoff, setDropoff] = useState({ text: '', lat: 0, lng: 0 });
  const [weight, setWeight] = useState('1');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    vehicle_type: string;
    distance_km: number;
    total_price: number;
    base_fare: number;
    per_km_rate: number;
  } | null>(null);

  const handleCalculate = async () => {
    if (!pickup.lat || !dropoff.lat) {
      toast.error('Lütfen adres seçin');
      return;
    }
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0) {
      toast.error('Geçerli ağırlık girin');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/pricing/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupLng: pickup.lng,
          pickupLat: pickup.lat,
          dropoffLng: dropoff.lng,
          dropoffLat: dropoff.lat,
          weightKg: w,
        }),
      });
      if (!res.ok) throw new Error('Hesaplama başarısız');
      const data = await res.json();
      setResult(data);
    } catch {
      toast.error('Fiyat hesaplanamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleOrder = () => {
    const params = new URLSearchParams({
      pickupAddress: pickup.text,
      pickupLat: String(pickup.lat),
      pickupLng: String(pickup.lng),
      dropoffAddress: dropoff.text,
      dropoffLat: String(dropoff.lat),
      dropoffLng: String(dropoff.lng),
      weightKg: weight,
    });
    router.push(`/new-order?${params.toString()}`);
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-5 shadow-2xl">
      <div>
        <h2 className="text-xl font-bold text-white">Anında Fiyat Al</h2>
        <p className="text-slate-400 text-sm mt-1">Canlı trafik verisiyle İstanbul içi hesaplama</p>
      </div>

      <AddressInput
        label="Nereden"
        icon={<MapPin className="w-4 h-4" />}
        value={pickup.text}
        onChange={(val) => setPickup((p) => ({ ...p, text: val, lat: 0, lng: 0 }))}
        onSelect={(f) => setPickup({ text: f.place_name, lat: f.center[1], lng: f.center[0] })}
        placeholder="Alım adresi ara..."
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
        onChange={(val) => setDropoff((p) => ({ ...p, text: val, lat: 0, lng: 0 }))}
        onSelect={(f) => setDropoff({ text: f.place_name, lat: f.center[1], lng: f.center[0] })}
        placeholder="Teslimat adresi ara..."
      />

      <div className="space-y-1">
        <Label className="text-slate-300 text-sm">Kargo Ağırlığı (kg)</Label>
        <div className="relative">
          <Weight className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="number"
            min="0.1"
            step="0.1"
            className="pl-9 bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <p className="text-xs text-slate-500">
          0-10kg: Moto &nbsp;|&nbsp; 10-75kg: Oto &nbsp;|&nbsp; 75kg+: Kamyonet
        </p>
      </div>

      <Button
        onClick={handleCalculate}
        disabled={loading}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-11 btn-orange-glow"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ücreti Hesapla'}
      </Button>

      {result && (
        <div className="bg-[#0a1628] border border-orange-500/30 rounded-xl p-4 space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {VEHICLE_ICONS[result.vehicle_type as keyof typeof VEHICLE_ICONS]}
              </span>
              <span className="text-slate-300 font-medium">
                {VEHICLE_LABELS[result.vehicle_type as keyof typeof VEHICLE_LABELS]}
              </span>
            </div>
            <span className="text-orange-500 font-bold text-sm">
              {result.distance_km.toFixed(1)} km
            </span>
          </div>
          <div className="text-xs text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>Açılış Ücreti</span>
              <span>{formatPrice(result.base_fare)}</span>
            </div>
            <div className="flex justify-between">
              <span>{result.distance_km.toFixed(1)} km × {formatPrice(result.per_km_rate)}/km</span>
              <span>{formatPrice(result.distance_km * result.per_km_rate)}</span>
            </div>
          </div>
          <div className="border-t border-[#1e4976]/40 pt-2 flex items-center justify-between">
            <span className="text-slate-300 font-semibold">Toplam</span>
            <span className="text-2xl font-bold text-orange-500">{formatPrice(result.total_price)}</span>
          </div>
          <Button
            onClick={handleOrder}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold btn-orange-glow"
          >
            Hemen Sipariş Ver <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
