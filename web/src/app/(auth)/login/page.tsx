'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error('Giriş başarısız: ' + error.message);
      setLoading(false);
      return;
    }
    toast.success('Giriş yapıldı!');
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <main className="min-h-screen hero-gradient flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
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
          <h1 className="text-2xl font-bold text-white mt-6">Hesabına Giriş Yap</h1>
          <p className="text-slate-400 text-sm mt-2">Hesabın yok mu? <Link href="/register" className="text-orange-400 hover:underline">Üye Ol</Link></p>
        </div>

        <form onSubmit={handleLogin} className="glass-card rounded-2xl p-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">E-posta</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500"
              placeholder="ornek@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">Şifre</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10 bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-11 btn-orange-glow"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Giriş Yap'}
          </Button>
        </form>
      </div>
    </main>
  );
}
