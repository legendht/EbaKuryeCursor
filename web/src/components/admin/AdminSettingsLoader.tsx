'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Loader2, MessageCircle, MapPin, Clock, Info, RefreshCw } from 'lucide-react';

interface Pricing {
  id: string; vehicle_type: string; base_fare: number;
  per_km_rate: number; min_weight_kg: number; max_weight_kg: number;
}
interface Setting { key: string; value: string; label?: string; }

const VEHICLE_INFO: Record<string, { label: string; icon: string; color: string }> = {
  motorcycle: { label: 'Motosiklet', icon: '🏍️', color: 'border-orange-500/40 bg-orange-500/5' },
  car:        { label: 'Otomobil',   icon: '🚗', color: 'border-blue-500/40 bg-blue-500/5' },
  van:        { label: 'Kamyonet',   icon: '🚐', color: 'border-purple-500/40 bg-purple-500/5' },
};

const SETTING_KEYS = [
  { key: 'whatsapp_number', label: 'WhatsApp Numarası',  icon: <MessageCircle className="w-4 h-4 text-green-400" />,  placeholder: '905XXXXXXXXX' },
  { key: 'company_address', label: 'Şirket Adresi',      icon: <MapPin className="w-4 h-4 text-orange-400" />,        placeholder: 'Kartal Sanayi, İstanbul' },
  { key: 'working_hours',   label: 'Çalışma Saatleri',   icon: <Clock className="w-4 h-4 text-blue-400" />,           placeholder: '07:00 - 23:00' },
];

export default function AdminSettingsLoader() {
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      setPricing(data.pricing || []);
      const map: Record<string, string> = {};
      for (const s of (data.settings || [])) map[s.key] = s.value;
      setSettings(map);
    } catch {
      toast.error('Veriler yüklenemedi');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updatePricing = (id: string, field: string, val: string) =>
    setPricing((prev) => prev.map((p) => p.id === id ? { ...p, [field]: parseFloat(val) || 0 } : p));

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsArr = SETTING_KEYS.map(({ key }) => ({ key, value: settings[key] ?? '' }));
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricing, settings: settingsArr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Hata');
      toast.success('Tüm ayarlar kaydedildi!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kayıt başarısız');
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sistem Ayarları</h1>
          <p className="text-slate-400 text-sm mt-1">Fiyatlandırma, iletişim ve genel site ayarları</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={load} variant="ghost" size="sm" className="text-slate-400 hover:text-white">
            <RefreshCw className="w-4 h-4 mr-1" /> Yenile
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold btn-orange-glow">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Kaydet
          </Button>
        </div>
      </div>

      {/* Fiyatlandırma */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-white font-semibold text-lg">Fiyatlandırma</h2>
          <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-full">
            <Info className="w-3 h-3" /> Kaydedince ana sayfaya yansır
          </span>
        </div>

        {pricing.length === 0 ? (
          <div className="glass-card rounded-xl p-8 border border-red-500/20 text-center text-slate-400">
            <p>Fiyat verisi bulunamadı.</p>
            <Button onClick={load} size="sm" className="mt-3 bg-orange-500 hover:bg-orange-600 text-white">
              <RefreshCw className="w-4 h-4 mr-1" /> Tekrar Yükle
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {pricing.map((p) => {
              const info = VEHICLE_INFO[p.vehicle_type] || { label: p.vehicle_type, icon: '📦', color: 'border-slate-500/40 bg-slate-500/5' };
              return (
                <div key={p.id} className={`glass-card rounded-xl p-5 border space-y-4 ${info.color}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{info.icon}</span>
                    <h3 className="text-white font-semibold">{info.label}</h3>
                  </div>
                  <div className="space-y-3">
                    <Field label="Açılış Ücreti (₺)" value={String(p.base_fare)} onChange={(v) => updatePricing(p.id, 'base_fare', v)} />
                    <Field label="KM Başı Ücret (₺/km)" value={String(p.per_km_rate)} onChange={(v) => updatePricing(p.id, 'per_km_rate', v)} />
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Min. Ağırlık (kg)" value={String(p.min_weight_kg)} onChange={(v) => updatePricing(p.id, 'min_weight_kg', v)} />
                      <Field label="Max. Ağırlık (kg)" value={String(p.max_weight_kg)} onChange={(v) => updatePricing(p.id, 'max_weight_kg', v)} />
                    </div>
                    <div className="text-xs text-slate-500 bg-[#0a1628]/60 rounded-lg p-2 text-center">
                      5km örnek: <span className="text-orange-400 font-semibold">
                        {Math.ceil(Number(p.base_fare) + 5 * Number(p.per_km_rate))}₺
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* İletişim & Genel */}
      <section className="space-y-4">
        <h2 className="text-white font-semibold text-lg">İletişim & Genel Ayarlar</h2>
        <div className="glass-card rounded-xl p-6 border border-[#1e4976]/40 space-y-5">
          {SETTING_KEYS.map(({ key, label, icon, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-slate-300 text-sm flex items-center gap-2">{icon} {label}</Label>
              <Input
                value={settings[key] ?? ''}
                onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                className="bg-[#0a1628] border-[#1e4976]/60 text-white placeholder:text-slate-600 focus:border-orange-500 max-w-md"
              />
            </div>
          ))}
          {settings['whatsapp_number'] && (
            <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-700/30 rounded-lg text-sm">
              <MessageCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-slate-300">Önizleme:</span>
              <a href={`https://wa.me/${(settings['whatsapp_number'] || '').replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline font-medium">
                wa.me/{(settings['whatsapp_number'] || '').replace(/\D/g, '')}
              </a>
            </div>
          )}
        </div>
      </section>

      <div className="flex items-center gap-4 pt-4 border-t border-[#1e4976]/40">
        <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 btn-orange-glow">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Tüm Ayarları Kaydet
        </Button>
        <p className="text-slate-500 text-sm">Kaydedilince fiyatlar ana sayfada anlık güncellenir.</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-slate-400 text-xs">{label}</Label>
      <Input type="number" step="any" value={value} onChange={(e) => onChange(e.target.value)}
        className="bg-[#0a1628] border-[#1e4976]/60 text-white text-sm h-9" />
    </div>
  );
}
