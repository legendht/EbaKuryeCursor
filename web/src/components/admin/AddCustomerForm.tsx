'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const EMPTY = {
  full_name: '', email: '', password: '', phone: '',
  company_name: '', tax_number: '', address: '', is_b2b: false,
};

export default function AddCustomerForm() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

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
      const res = await fetch('/api/admin/create-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Müşteri oluşturulamadı');
      }
      toast.success('Müşteri başarıyla oluşturuldu!');
      setForm(EMPTY);
      setOpen(false);
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
          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <UserPlus className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-white font-semibold">Yeni Müşteri Ekle</span>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-[#1e4976]/40 space-y-5 pt-4">
          {/* Müşteri tipi */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => set('is_b2b', false)}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${!form.is_b2b ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'border-[#1e4976]/40 text-slate-400 hover:border-slate-500'}`}
            >
              Bireysel (B2C)
            </button>
            <button
              type="button"
              onClick={() => set('is_b2b', true)}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${form.is_b2b ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'border-[#1e4976]/40 text-slate-400 hover:border-slate-500'}`}
            >
              Kurumsal (B2B)
            </button>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Ad Soyad *" value={form.full_name} onChange={(v) => set('full_name', v)} placeholder="Ahmet Yılmaz" />
            <Field label="Telefon *" value={form.phone} onChange={(v) => set('phone', v)} placeholder="05XX XXX XX XX" />
            <Field label="E-posta *" value={form.email} onChange={(v) => set('email', v)} placeholder="musteri@email.com" type="email" />
            <Field label="Şifre *" value={form.password} onChange={(v) => set('password', v)} placeholder="Min. 6 karakter" type="password" />
            <Field label="Adres" value={form.address} onChange={(v) => set('address', v)} placeholder="İstanbul..." />
            {form.is_b2b && (
              <>
                <Field label="Firma Adı" value={form.company_name} onChange={(v) => set('company_name', v)} placeholder="Firma A.Ş." />
                <Field label="Vergi Numarası" value={form.tax_number} onChange={(v) => set('tax_number', v)} placeholder="1234567890" />
              </>
            )}
          </div>

          <div className="flex gap-3 pt-2 border-t border-[#1e4976]/40">
            <Button onClick={handleSubmit} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold btn-orange-glow">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Müşteri Oluştur
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-slate-400">İptal</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-slate-300 text-sm">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="bg-[#0a1628] border-[#1e4976]/60 text-white placeholder:text-slate-600 focus:border-orange-500 text-sm" />
    </div>
  );
}
