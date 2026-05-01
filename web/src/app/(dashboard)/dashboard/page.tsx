import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/layout/Navbar';
import LogoutButton from '@/components/layout/LogoutButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Package, TrendingUp, Clock, CheckCircle2, ShieldCheck } from 'lucide-react';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, formatPrice } from '@/lib/pricing';
import type { Order, Profile, CustomerAccount } from '@/types/database';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, ordersRes, accountRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('orders').select('*').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('customer_accounts').select('*').eq('customer_id', user.id).single(),
  ]);

  const profile = profileRes.data as unknown as Profile;
  const orders = (ordersRes.data || []) as Order[];
  const account = accountRes.data as CustomerAccount | null;

  const stats = {
    total: orders.length,
    active: orders.filter((o) => ['assigned', 'pickup', 'in_transit'].includes(o.status)).length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    spent: orders.filter((o) => o.status === 'delivered').reduce((s, o) => s + o.total_price, 0),
  };

  return (
    <main className="min-h-screen bg-[#0a1628]">
      <Navbar profile={profile} />
      <div className="max-w-6xl mx-auto px-4 pt-24 pb-16 space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Merhaba, {profile?.full_name?.split(' ')[0] || 'Kullanıcı'} 👋</h1>
            <p className="text-slate-400 text-sm mt-1">Siparişlerinizi takip edin ve yönetin</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {profile?.role === 'admin' && (
              <Link href="/admin">
                <Button variant="outline" size="sm" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10 gap-1">
                  <ShieldCheck className="w-4 h-4" /> Admin Paneli
                </Button>
              </Link>
            )}
            <Link href="/new-order">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold btn-orange-glow">
                <Plus className="w-4 h-4 mr-2" /> Yeni Sipariş
              </Button>
            </Link>
            <LogoutButton />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: <Package className="w-5 h-5 text-orange-500" />, label: 'Toplam Sipariş', value: stats.total },
            { icon: <Clock className="w-5 h-5 text-blue-400" />, label: 'Aktif', value: stats.active },
            { icon: <CheckCircle2 className="w-5 h-5 text-green-400" />, label: 'Teslim Edildi', value: stats.delivered },
            { icon: <TrendingUp className="w-5 h-5 text-purple-400" />, label: 'Toplam Harcama', value: formatPrice(stats.spent) },
          ].map((stat) => (
            <div key={stat.label} className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">{stat.icon}<span className="text-slate-400 text-xs">{stat.label}</span></div>
              <div className="text-xl font-bold text-white">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Account Balance */}
        {account !== null && (
          <div className="glass-card rounded-xl p-6 border border-[#1e4976]/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet className="w-6 h-6 text-orange-500" />
                <div>
                  <p className="text-slate-400 text-sm">Cari Hesap Bakiyesi</p>
                  <p className={`text-2xl font-bold ${account.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPrice(account.balance)}
                  </p>
                </div>
              </div>
              <Link href="/account">
                <Button variant="outline" size="sm" className="border-[#1e4976] text-slate-300 hover:border-orange-500">
                  Detaylar
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#1e4976]/40">
            <h2 className="text-white font-semibold">Son Siparişler</h2>
          </div>
          {orders.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Henüz sipariş yok</p>
              <Link href="/new-order" className="mt-4 inline-block">
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white mt-4">
                  İlk Siparişini Ver
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e4976]/40">
                    {['Takip Kodu', 'Nereden', 'Nereye', 'Araç', 'Tutar', 'Durum', ''].map((h) => (
                      <th key={h} className="text-left text-slate-400 font-medium px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-[#1e4976]/20 hover:bg-[#1e4976]/10 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-orange-400 text-xs font-semibold">{order.tracking_code}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 max-w-[150px] truncate">{order.pickup_address}</td>
                      <td className="px-4 py-3 text-slate-300 max-w-[150px] truncate">{order.dropoff_address}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {order.vehicle_type === 'motorcycle' ? '🏍️' : order.vehicle_type === 'car' ? '🚗' : '🚐'}
                      </td>
                      <td className="px-4 py-3 text-white font-semibold">{formatPrice(order.total_price)}</td>
                      <td className="px-4 py-3">
                        <Badge className={`border text-xs ${ORDER_STATUS_COLORS[order.status]}`}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/track?code=${order.tracking_code}`}>
                          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-orange-400 text-xs">
                            Takip
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
