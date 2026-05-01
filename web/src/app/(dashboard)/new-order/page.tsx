'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, ArrowRight, Loader2, Weight, Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { geocodeAddress, type GeocodingFeature } from '@/lib/mapbox';
import { formatPrice, VEHICLE_LABELS, VEHICLE_ICONS } from '@/lib/pricing';
import { compressImage, uploadFile } from '@/lib/image-compress';
import { toast } from 'sonner';
import Link from 'next/link';
import { Package } from 'lucide-react';

function AddressInput({ label, icon, value, onChange, onSelect, placeholder }: {
  label: string; icon: React.ReactNode; value: string;
  onChange: (v: string) => void; onSelect: (f: GeocodingFeature) => void; placeholder: string;
}) {
  const [results, setResults] = useState<GeocodingFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setResults([]); return; }
    setLoading(true);
    const data = await geocodeAddress(q);
    setResults(data); setOpen(data.length > 0); setLoading(false);
  }, []);

  useEffect(() => { const t = setTimeout(() => search(value), 350); return () => clearTimeout(t); }, [value, search]);

  return (
    <div className="space-y-1 relative">
      <Label className="text-slate-300 text-sm">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        <Input className="pl-9 bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500"
          placeholder={placeholder} value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          autoComplete="off" />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#0f2340] border border-[#1e4976]/60 rounded-lg shadow-2xl overflow-hidden">
          {results.map((feat) => (
            <button key={feat.id} type="button"
              className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-[#1e4976]/50 transition-colors border-b border-[#1e4976]/30 last:border-0"
              onMouseDown={() => { onSelect(feat); onChange(feat.place_name); setOpen(false); }}>
              <span className="font-medium">{feat.text}</span>
              <span className="text-slate-400 ml-2 text-xs">{feat.place_name.split(',').slice(1).join(',').trim()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NewOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm] = useState({
    pickup: { text: searchParams.get('pickupAddress') || '', lat: parseFloat(searchParams.get('pickupLat') || '0'), lng: parseFloat(searchParams.get('pickupLng') || '0') },
    dropoff: { text: searchParams.get('dropoffAddress') || '', lat: parseFloat(searchParams.get('dropoffLat') || '0'), lng: parseFloat(searchParams.get('dropoffLng') || '0') },
    weight: searchParams.get('weightKg') || '1',
    pickupContact: '', pickupPhone: '',
    dropoffContact: '', dropoffPhone: '',
    description: '', notes: '',
  });
  const [cargoPhoto, setCargoPhoto] = useState<File | null>(null);
  const [cargoPhotoPreview, setCargoPhotoPreview] = useState<string | null>(null);
  const [price, setPrice] = useState<{ vehicle_type: string; distance_km: number; total_price: number; base_fare: number; per_km_rate: number } | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  const calculatePrice = useCallback(async () => {
    if (!form.pickup.lat || !form.dropoff.lat) return;
    setPriceLoading(true);
    try {
      const res = await fetch('/api/pricing/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupLng: form.pickup.lng, pickupLat: form.pickup.lat, dropoffLng: form.dropoff.lng, dropoffLat: form.dropoff.lat, weightKg: parseFloat(form.weight) }),
      });
      if (!res.ok) throw new Error();
      setPrice(await res.json());
    } catch { toast.error('Fiyat hesaplanamadı'); }
    finally { setPriceLoading(false); }
  }, [form.pickup, form.dropoff, form.weight]);

  useEffect(() => {
    if (form.pickup.lat && form.dropoff.lat && form.weight) {
      const t = setTimeout(calculatePrice, 500);
      return () => clearTimeout(t);
    }
  }, [form.pickup.lat, form.dropoff.lat, form.weight, calculatePrice]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setCargoPhoto(compressed);
    setCargoPhotoPreview(URL.createObjectURL(compressed));
    toast.success(`Fotoğraf sıkıştırıldı: ${(compressed.size / 1024).toFixed(0)}KB`);
  };

  const handleSubmit = async () => {
    if (!form.pickup.lat || !form.dropoff.lat) { toast.error('Lütfen adres seçin'); return; }
    if (!price) { toast.error('Önce fiyat hesaplayın'); return; }
    setSubmitting(true);
    try {
      let cargoPhotoUrl = null;
      if (cargoPhoto) { cargoPhotoUrl = await uploadFile(cargoPhoto, 'cargo'); }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupAddress: form.pickup.text, pickupLat: form.pickup.lat, pickupLng: form.pickup.lng,
          pickupContact: form.pickupContact, pickupPhone: form.pickupPhone,
          dropoffAddress: form.dropoff.text, dropoffLat: form.dropoff.lat, dropoffLng: form.dropoff.lng,
          dropoffContact: form.dropoffContact, dropoffPhone: form.dropoffPhone,
          weightKg: parseFloat(form.weight), description: form.description,
          cargoPhotoUrl, notes: form.notes,
        }),
      });
      if (!res.ok) throw new Error('Sipariş oluşturulamadı');
      const { order } = await res.json();
      toast.success(`Sipariş oluşturuldu! Takip: ${order.tracking_code}`);
      router.push(`/track?code=${order.tracking_code}`);
    } catch { toast.error('Sipariş oluşturulamadı'); }
    finally { setSubmitting(false); }
  };

  return (
    <main className="min-h-screen bg-[#0a1628]">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a1628]/90 backdrop-blur-md border-b border-[#1e4976]/40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold"><span className="text-white">EBA</span><span className="text-orange-500"> Kurye</span></span>
          </Link>
          <Link href="/dashboard"><Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">Panele Dön</Button></Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 pt-24 pb-16">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Yeni Sipariş</h1>
          <p className="text-slate-400 text-sm mt-1">Alım ve teslimat bilgilerini doldurun</p>
        </div>

        <div className="space-y-6">
          {/* Addresses */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Adres Bilgileri</h2>
            <AddressInput label="Nereden (Alım)" icon={<MapPin className="w-4 h-4" />}
              value={form.pickup.text}
              onChange={(v) => setForm((f) => ({ ...f, pickup: { text: v, lat: 0, lng: 0 } }))}
              onSelect={(feat) => setForm((f) => ({ ...f, pickup: { text: feat.place_name, lat: feat.center[1], lng: feat.center[0] } }))}
              placeholder="Alım adresi ara..." />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Alıcı Adı (isteğe bağlı)</Label>
                <Input className="bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500 text-sm"
                  value={form.pickupContact} onChange={(e) => setForm((f) => ({ ...f, pickupContact: e.target.value }))} placeholder="Ad Soyad" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Telefon</Label>
                <Input className="bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500 text-sm"
                  value={form.pickupPhone} onChange={(e) => setForm((f) => ({ ...f, pickupPhone: e.target.value }))} placeholder="05XX..." />
              </div>
            </div>

            <div className="flex justify-center py-2">
              <div className="w-8 h-8 rounded-full border border-[#1e4976]/60 flex items-center justify-center bg-[#0f2340]">
                <ArrowRight className="w-4 h-4 text-orange-500" />
              </div>
            </div>

            <AddressInput label="Nereye (Teslimat)" icon={<MapPin className="w-4 h-4 text-orange-500" />}
              value={form.dropoff.text}
              onChange={(v) => setForm((f) => ({ ...f, dropoff: { text: v, lat: 0, lng: 0 } }))}
              onSelect={(feat) => setForm((f) => ({ ...f, dropoff: { text: feat.place_name, lat: feat.center[1], lng: feat.center[0] } }))}
              placeholder="Teslimat adresi ara..." />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Teslim Edilecek Kişi</Label>
                <Input className="bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500 text-sm"
                  value={form.dropoffContact} onChange={(e) => setForm((f) => ({ ...f, dropoffContact: e.target.value }))} placeholder="Ad Soyad" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Telefon</Label>
                <Input className="bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500 text-sm"
                  value={form.dropoffPhone} onChange={(e) => setForm((f) => ({ ...f, dropoffPhone: e.target.value }))} placeholder="05XX..." />
              </div>
            </div>
          </div>

          {/* Cargo Details */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="text-white font-semibold">Kargo Detayları</h2>
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Ağırlık (kg)</Label>
              <div className="relative">
                <Weight className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input type="number" min="0.1" step="0.1"
                  className="pl-9 bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500"
                  value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Açıklama (isteğe bağlı)</Label>
              <Input className="bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500"
                value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Paket içeriği..." />
            </div>

            {/* Cargo Photo */}
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Ürün Fotoğrafı (isteğe bağlı)</Label>
              {cargoPhotoPreview ? (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cargoPhotoPreview} alt="Kargo" className="w-24 h-24 object-cover rounded-lg border border-[#1e4976]/60" />
                  <button type="button" onClick={() => { setCargoPhoto(null); setCargoPhotoPreview(null); }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer w-fit">
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#0f2340] border border-[#1e4976]/60 rounded-lg text-slate-300 hover:border-orange-500 transition-colors text-sm">
                    <Camera className="w-4 h-4" /> Fotoğraf Ekle
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Notlar</Label>
              <Input className="bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500"
                value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Kurye için notlar..." />
            </div>
          </div>

          {/* Price Summary */}
          {priceLoading && (
            <div className="glass-card rounded-2xl p-6 flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
              <span className="text-slate-400">Fiyat hesaplanıyor...</span>
            </div>
          )}

          {price && !priceLoading && (
            <div className="bg-[#0a1628] border border-orange-500/30 rounded-2xl p-6 space-y-4">
              <h2 className="text-white font-semibold">Fiyat Özeti</h2>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{VEHICLE_ICONS[price.vehicle_type as keyof typeof VEHICLE_ICONS]}</span>
                <div>
                  <p className="text-white font-semibold">{VEHICLE_LABELS[price.vehicle_type as keyof typeof VEHICLE_LABELS]}</p>
                  <p className="text-slate-400 text-sm">{price.distance_km.toFixed(1)} km</p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-slate-400">
                <div className="flex justify-between"><span>Açılış Ücreti</span><span>{formatPrice(price.base_fare)}</span></div>
                <div className="flex justify-between"><span>{price.distance_km.toFixed(1)} km × {formatPrice(price.per_km_rate)}/km</span><span>{formatPrice(price.distance_km * price.per_km_rate)}</span></div>
              </div>
              <div className="border-t border-[#1e4976]/40 pt-3 flex justify-between items-center">
                <span className="text-white font-bold text-lg">Toplam</span>
                <span className="text-orange-500 font-bold text-2xl">{formatPrice(price.total_price)}</span>
              </div>

              <Button onClick={handleSubmit} disabled={submitting}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 btn-orange-glow text-base">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : `${formatPrice(price.total_price)} ile Sipariş Ver`}
              </Button>
            </div>
          )}

          {!price && !priceLoading && (
            <p className="text-center text-slate-500 text-sm">
              Alım ve teslimat adresi seçildiğinde fiyat otomatik hesaplanır.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a1628] flex items-center justify-center"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>}>
      <NewOrderForm />
    </Suspense>
  );
}
