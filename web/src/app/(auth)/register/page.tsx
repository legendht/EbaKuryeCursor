'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', isB2B: false, companyName: '' });
  const [loading, setLoading] = useState(false);

  const set = (key: string, val: string | boolean) => setForm((f) => ({ ...f, [key]: val }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) { toast.error('Şifre en az 6 karakter olmalı'); return; }
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          phone: form.phone,
          is_b2b: form.isB2B,
          company_name: form.isB2B ? form.companyName : null,
        },
      },
    });

    if (error) {
      toast.error('Kayıt başarısız: ' + error.message);
      setLoading(false);
      return;
    }

    toast.success('Kayıt başarılı! Lütfen e-postanızı doğrulayın.');
    router.push('/login');
  };

  return (
    <main className="min-h-screen hero-gradient flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold">
              <span className="text-white">EBA</span>
              <span className="text-orange-500"> Kurye</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-white mt-6">Üye Ol</h1>
          <p className="text-slate-400 text-sm mt-2">Hesabın var mı? <Link href="/login" className="text-orange-400 hover:underline">Giriş Yap</Link></p>
        </div>

        <form onSubmit={handleRegister} className="glass-card rounded-2xl p-8 space-y-4">
          {/* B2B Toggle */}
          <div className="flex gap-2">
            {['Bireysel (B2C)', 'Kurumsal (B2B)'].map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => set('isB2B', i === 1)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${form.isB2B === (i === 1)
                  ? 'bg-orange-500 text-white'
                  : 'bg-[#0f2340] text-slate-400 border border-[#1e4976]/60'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Ad Soyad</Label>
            <Input required value={form.fullName} onChange={(e) => set('fullName', e.target.value)}
              className="bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500"
              placeholder="Ad Soyad" />
          </div>

          {form.isB2B && (
            <div className="space-y-2">
              <Label className="text-slate-300">Şirket Adı</Label>
              <Input required={form.isB2B} value={form.companyName} onChange={(e) => set('companyName', e.target.value)}
                className="bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500"
                placeholder="Şirket Adı" />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-slate-300">E-posta</Label>
            <Input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)}
              className="bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500"
              placeholder="ornek@email.com" />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Telefon</Label>
            <Input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)}
              className="bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500"
              placeholder="05XX XXX XX XX" />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Şifre</Label>
            <Input type="password" required value={form.password} onChange={(e) => set('password', e.target.value)}
              className="bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500"
              placeholder="En az 6 karakter" />
          </div>

          <Button type="submit" disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-11 btn-orange-glow mt-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Üye Ol'}
          </Button>
        </form>
      </div>
    </main>
  );
}
