'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Loader2 } from 'lucide-react';
import type { PricingConfig, SiteSetting } from '@/types/database';

export default function AdminSettingsPage() {
  const supabase = createClient();
  const [pricing, setPricing] = useState<PricingConfig[]>([]);
  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    Promise.all([
      db.from('pricing_config').select('*').order('min_weight_kg'),
      db.from('site_settings').select('*'),
    ]).then(([p, s]) => {
      setPricing((p.data || []) as PricingConfig[]);
      setSettings((s.data || []) as SiteSetting[]);
      setLoading(false);
    });
  }, []);

  const updatePricing = (id: string, field: string, value: string) => {
    setPricing((prev) => prev.map((p) => p.id === id ? { ...p, [field]: parseFloat(value) } : p));
  };

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => prev.map((s) => s.key === key ? { ...s, value } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    try {
      await Promise.all([
        ...pricing.map((p) =>
          db.from('pricing_config').update({
            base_fare: p.base_fare,
            per_km_rate: p.per_km_rate,
            min_weight_kg: p.min_weight_kg,
            max_weight_kg: p.max_weight_kg,
          }).eq('id', p.id)
        ),
        ...settings.map((s) =>
          db.from('site_settings').update({ value: s.value }).eq('key', s.key)
        ),
      ]);
      toast.success('Ayarlar kaydedildi!');
    } catch {
      toast.error('Kayıt başarısız');
    }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>;

  const VEHICLE_LABELS: Record<string, string> = { motorcycle: '🏍️ Motosiklet', car: '🚗 Otomobil', van: '🚐 Kamyonet' };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Sistem Ayarları</h1>
        <p className="text-slate-400 text-sm mt-1">Fiyatlandırma ve genel ayarlar</p>
      </div>

      {/* Pricing */}
      <div className="glass-card rounded-xl p-6 border border-[#1e4976]/40 space-y-6">
        <h2 className="text-white font-semibold">Fiyatlandırma Ayarları</h2>
        {pricing.map((p) => (
          <div key={p.id} className="space-y-3">
            <h3 className="text-orange-400 font-medium">{VEHICLE_LABELS[p.vehicle_type] || p.vehicle_type}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Açılış Ücreti (₺)</Label>
                <Input type="number" step="0.01" value={p.base_fare}
                  onChange={(e) => updatePricing(p.id, 'base_fare', e.target.value)}
                  className="bg-[#0a1628] border-[#1e4976]/60 text-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">KM Ücreti (₺/km)</Label>
                <Input type="number" step="0.01" value={p.per_km_rate}
                  onChange={(e) => updatePricing(p.id, 'per_km_rate', e.target.value)}
                  className="bg-[#0a1628] border-[#1e4976]/60 text-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Min. Ağırlık (kg)</Label>
                <Input type="number" step="0.1" value={p.min_weight_kg}
                  onChange={(e) => updatePricing(p.id, 'min_weight_kg', e.target.value)}
                  className="bg-[#0a1628] border-[#1e4976]/60 text-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Max. Ağırlık (kg)</Label>
                <Input type="number" step="0.1" value={p.max_weight_kg}
                  onChange={(e) => updatePricing(p.id, 'max_weight_kg', e.target.value)}
                  className="bg-[#0a1628] border-[#1e4976]/60 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Site Settings */}
      <div className="glass-card rounded-xl p-6 border border-[#1e4976]/40 space-y-4">
        <h2 className="text-white font-semibold">Genel Ayarlar</h2>
        {settings.map((s) => (
          <div key={s.key} className="space-y-1">
            <Label className="text-slate-300 text-sm">{s.label || s.key}</Label>
            <Input value={s.value} onChange={(e) => updateSetting(s.key, e.target.value)}
              className="bg-[#0a1628] border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500" />
          </div>
        ))}
      </div>

      <Button onClick={handleSave} disabled={saving}
        className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 btn-orange-glow">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Kaydet
      </Button>
    </div>
  );
}
