import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/pricing';
import { Package, Truck, Users, TrendingUp, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import AdminLiveMap from '@/components/admin/AdminLiveMap';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const [ordersRes, couriersRes, customersRes, todayOrdersRes] = await Promise.all([
    supabase.from('orders').select('status, total_price, vehicle_type', { count: 'exact' }),
    supabase.from('couriers').select('status, vehicle_type', { count: 'exact' }),
    supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'customer'),
    supabase.from('orders').select('total_price, status, vehicle_type').gte('created_at', today),
  ]);

  const orders = (ordersRes.data || []) as { status: string; total_price: number; vehicle_type: string }[];
  const couriers = (couriersRes.data || []) as { status: string; vehicle_type: string }[];
  const todayOrders = (todayOrdersRes.data || []) as { status: string; total_price: number; vehicle_type: string }[];

  const stats = {
    totalOrders: ordersRes.count || 0,
    activeOrders: orders.filter((o) => ['assigned', 'pickup', 'in_transit'].includes(o.status)).length,
    deliveredToday: todayOrders.filter((o) => o.status === 'delivered').length,
    revenueToday: todayOrders.filter((o) => o.status === 'delivered').reduce((s, o) => s + (o.total_price || 0), 0),
    onlineCouriers: couriers.filter((c) => c.status === 'online').length,
    totalCouriers: couriersRes.count || 0,
    totalCustomers: customersRes.count || 0,
  };

  const vehicleStats = ['motorcycle', 'car', 'van'].map((v) => ({
    type: v,
    label: v === 'motorcycle' ? 'Motosiklet' : v === 'car' ? 'Otomobil' : 'Kamyonet',
    icon: v === 'motorcycle' ? '🏍️' : v === 'car' ? '🚗' : '🚐',
    count: todayOrders.filter((o) => o.vehicle_type === v).length,
    revenue: todayOrders.filter((o) => o.vehicle_type === v && o.status === 'delivered').reduce((s, o) => s + (o.total_price || 0), 0),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Genel bakış ve anlık durum</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: <TrendingUp className="w-6 h-6 text-green-400" />, label: 'Bugünkü Ciro', value: formatPrice(stats.revenueToday), sub: `${stats.deliveredToday} teslimat` },
          { icon: <Package className="w-6 h-6 text-orange-400" />, label: 'Aktif Sipariş', value: stats.activeOrders, sub: `${stats.totalOrders} toplam` },
          { icon: <Truck className="w-6 h-6 text-blue-400" />, label: 'Online Kurye', value: `${stats.onlineCouriers}/${stats.totalCouriers}`, sub: 'aktif/toplam' },
          { icon: <Users className="w-6 h-6 text-purple-400" />, label: 'Müşteriler', value: stats.totalCustomers, sub: 'kayıtlı' },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-xl p-5 border border-[#1e4976]/40">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-sm">{stat.label}</span>
              {stat.icon}
            </div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-xs text-slate-500 mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Vehicle breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {vehicleStats.map((v) => (
          <div key={v.type} className="glass-card rounded-xl p-5 border border-[#1e4976]/40">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{v.icon}</span>
              <span className="text-white font-semibold">{v.label}</span>
            </div>
            <div className="text-xl font-bold text-orange-400">{formatPrice(v.revenue)}</div>
            <div className="text-xs text-slate-500 mt-1">{v.count} sipariş bugün</div>
          </div>
        ))}
      </div>

      {/* Mini Live Map */}
      <div className="glass-card rounded-xl overflow-hidden border border-[#1e4976]/40">
        <div className="p-4 border-b border-[#1e4976]/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <h2 className="text-white font-semibold">Filo Canlı Harita</h2>
          </div>
          <a href="/admin/map" className="text-orange-400 hover:underline text-sm">Tam Harita →</a>
        </div>
        <AdminLiveMap height={400} mini />
      </div>
    </div>
  );
}
