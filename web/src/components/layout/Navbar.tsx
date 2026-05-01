'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, Package, User, LogOut, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { Profile } from '@/types/database';

interface NavbarProps {
  profile?: Profile | null;
}

export default function Navbar({ profile }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a1628]/90 backdrop-blur-md border-b border-[#1e4976]/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">
              <span className="text-white">EBA</span>
              <span className="text-orange-500"> Kurye</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/#services" className="text-slate-300 hover:text-orange-400 transition-colors text-sm">
              Hizmetler
            </Link>
            <Link href="/#pricing" className="text-slate-300 hover:text-orange-400 transition-colors text-sm">
              Fiyatlar
            </Link>
            <Link href="/track" className="text-slate-300 hover:text-orange-400 transition-colors text-sm">
              Takip Et
            </Link>
            <Link href="/#contact" className="text-slate-300 hover:text-orange-400 transition-colors text-sm">
              İletişim
            </Link>
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-3">
            {profile ? (
              <>
                {profile.role === 'admin' && (
                  <Link href="/admin">
                    <Button variant="ghost" size="sm" className="text-slate-300 hover:text-orange-400">
                      <ShieldCheck className="w-4 h-4 mr-1" /> Admin
                    </Button>
                  </Link>
                )}
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm" className="text-slate-300 hover:text-orange-400">
                    <LayoutDashboard className="w-4 h-4 mr-1" /> Panelim
                  </Button>
                </Link>
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-red-400 gap-1"
                >
                  <LogOut className="w-4 h-4" /> Çıkış
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
                    Giriş Yap
                  </Button>
                </Link>
                <Link href="/register">
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                  >
                    Üye Ol
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-slate-300"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {open && (
          <div className="md:hidden py-4 border-t border-[#1e4976]/40 space-y-2">
            {[
              { href: '/#services', label: 'Hizmetler' },
              { href: '/#pricing', label: 'Fiyatlar' },
              { href: '/track', label: 'Takip Et' },
              { href: '/#contact', label: 'İletişim' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-4 py-2 text-slate-300 hover:text-orange-400 transition-colors"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="px-4 pt-2 flex gap-2">
              {profile ? (
                <>
                  <Link href="/dashboard" className="flex-1">
                    <Button className="w-full" variant="outline" size="sm">Panelim</Button>
                  </Link>
                  <Button onClick={handleLogout} variant="ghost" size="sm" className="text-red-400">
                    Çıkış
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/login" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">Giriş Yap</Button>
                  </Link>
                  <Link href="/register" className="flex-1">
                    <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600">Üye Ol</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
