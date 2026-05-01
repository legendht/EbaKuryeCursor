'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, UserPlus, Loader2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const VEHICLE_OPTIONS = [
  { value: 'motorcycle', label: '🏍️ Motosiklet' },
  { value: 'car',        label: '🚗 Otomobil' },
  { value: 'van',        label: '🚐 Kamyonet' },
];

const EMPTY = {
  full_name: '', email: '', password: '', phone: '',
  tc_no: '', home_address: '', vehicle_type: 'motorcycle',
  vehicle_plate: '', vehicle_model: '', license_number: '',
};

export default function AddCourierForm() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!form.full_name || !form.email || !form.password || !form.phone) {
      toast.error('Ad Soyad, e-posta, şifre ve telefon zorunludur');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalı');
      return;
    }
    setSaving(true);
    try {
      // 1. Kullanıcı oluştur via API
      const res = await fetch('/api/admin/create-courier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, hasPhoto: !!photo }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Kurye oluşturulamadı');
      }
      const { courierId } = await res.json();

      // 2. Profil fotoğrafı yükle
      if (photo && courierId) {
        const fd = new FormData();
        fd.append('file', photo);
        fd.append('type', 'profile');
        fd.append('id', courierId);
        await fetch('/api/upload', { method: 'POST', body: fd });
      }

      toast.success('Kurye başarıyla oluşturuldu!');
      setForm(EMPTY);
      setPhoto(null);
      setPhotoPreview(null);
      setOpen(false);
      // Tam sayfa yenile — server component listeyi yeniden çeksin
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Hata oluştu');
    }
    setSaving(false);
  };

  return (
    <div className="glass-card rounded-xl border border-[#1e4976]/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#1e4976]/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
            <UserPlus className="w-4 h-4 text-orange-400" />
          </div>
          <span className="text-white font-semibold">Yeni Kurye Ekle</span>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-6 border-t border-[#1e4976]/40">
          <div className="pt-4 grid md:grid-cols-2 gap-5">

            {/* Kişisel Bilgiler */}
            <div className="space-y-4 md:col-span-2">
              <h3 className="text-orange-400 text-sm font-semibold uppercase tracking-wide">Kişisel Bilgiler</h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                <Field label="Ad Soyad *" value={form.full_name} onChange={(v) => set('full_name', v)} placeholder="Ahmet Yılmaz" />
                <Field label="T.C. Kimlik No" value={form.tc_no} onChange={(v) => set('tc_no', v)} placeholder="12345678901" maxLength={11} />
                <Field label="Telefon *" value={form.phone} onChange={(v) => set('phone', v)} placeholder="05XX XXX XX XX" />
                <Field label="E-posta *" value={form.email} onChange={(v) => set('email', v)} placeholder="kurye@email.com" type="email" />
                <Field label="Şifre *" value={form.password} onChange={(v) => set('password', v)} placeholder="Min. 6 karakter" type="password" />
                <div className="sm:col-span-2 md:col-span-1">
                  <Field label="Ev Adresi" value={form.home_address} onChange={(v) => set('home_address', v)} placeholder="Mahalle, Sokak, No" />
                </div>
              </div>
            </div>

            {/* Araç Bilgileri */}
            <div className="space-y-4 md:col-span-2">
              <h3 className="text-orange-400 text-sm font-semibold uppercase tracking-wide">Araç Bilgileri</h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-300 text-sm">Araç Tipi *</Label>
                  <select
                    value={form.vehicle_type}
                    onChange={(e) => set('vehicle_type', e.target.value)}
                    className="w-full bg-[#0a1628] border border-[#1e4976]/60 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                  >
                    {VEHICLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <Field label="Araç Plakası" value={form.vehicle_plate} onChange={(v) => set('vehicle_plate', v.toUpperCase())} placeholder="34 ABC 123" />
                <Field label="Araç Modeli" value={form.vehicle_model} onChange={(v) => set('vehicle_model', v)} placeholder="Honda CBR 2022" />
                <Field label="Ruhsat Numarası" value={form.license_number} onChange={(v) => set('license_number', v)} placeholder="RUHSAT NO" />
              </div>
            </div>

            {/* Profil Fotoğrafı */}
            <div className="space-y-3 md:col-span-2">
              <h3 className="text-orange-400 text-sm font-semibold uppercase tracking-wide">Profil Fotoğrafı</h3>
              <div className="flex items-center gap-4">
                {photoPreview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="Profil" className="w-20 h-20 rounded-full object-cover border-2 border-orange-500/50" />
                    <button
                      type="button"
                      onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs"
                    >×</button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-[#0a1628] border-2 border-dashed border-[#1e4976]/60 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-slate-500" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <div className="px-4 py-2 bg-[#0f2340] border border-[#1e4976]/60 rounded-lg text-slate-300 hover:border-orange-500 transition-colors text-sm">
                    Fotoğraf Seç
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-[#1e4976]/40">
            <Button onClick={handleSubmit} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold btn-orange-glow">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Kurye Oluştur
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-slate-400">
              İptal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; maxLength?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-slate-300 text-sm">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="bg-[#0a1628] border-[#1e4976]/60 text-white placeholder:text-slate-600 focus:border-orange-500 text-sm"
      />
    </div>
  );
}
