'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, MapPin, Package, Users, Truck,
  Settings, DollarSign, LogOut, Package2
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { href: '/admin/map', icon: <MapPin className="w-5 h-5" />, label: 'Canlı Harita' },
  { href: '/admin/orders', icon: <Package className="w-5 h-5" />, label: 'Siparişler' },
  { href: '/admin/couriers', icon: <Truck className="w-5 h-5" />, label: 'Kuryeler' },
  { href: '/admin/customers', icon: <Users className="w-5 h-5" />, label: 'Müşteriler' },
  { href: '/admin/finance', icon: <DollarSign className="w-5 h-5" />, label: 'Finans' },
  { href: '/admin/settings', icon: <Settings className="w-5 h-5" />, label: 'Ayarlar' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#0f2340] border-r border-[#1e4976]/40 flex flex-col z-40">
      {/* Logo */}
      <div className="p-6 border-b border-[#1e4976]/40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Package2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold">EBA Kurye</p>
            <p className="text-orange-400 text-xs">Admin Paneli</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm font-medium ${active
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'text-slate-400 hover:text-white hover:bg-[#1e4976]/40'
                }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-[#1e4976]/40">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm"
        >
          <LogOut className="w-5 h-5" />
          Çıkış Yap
        </button>
      </div>
    </aside>
  );
}
