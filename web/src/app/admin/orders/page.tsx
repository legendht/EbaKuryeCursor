import { createClient } from '@/lib/supabase/server';
import AdminOrderRow from '@/components/admin/AdminOrderRow';

export const dynamic = 'force-dynamic';

type OrderRow = {
  id: string; tracking_code: string; status: string;
  pickup_address: string; dropoff_address: string;
  vehicle_type: string; total_price: number;
  courier_id: string | null; created_at: string;
  customer?: { full_name: string; phone: string } | null;
  courier?: { vehicle_type: string; vehicle_plate: string } | null;
};

export default async function AdminOrdersPage() {
  const supabase = await createClient();
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, tracking_code, status, pickup_address, dropoff_address, vehicle_type, total_price, courier_id, created_at, customer:profiles(full_name, phone), courier:couriers(vehicle_type, vehicle_plate)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) console.error('[admin orders]', error);

  const { data: couriersData } = await supabase
    .from('couriers')
    .select('id, vehicle_type, vehicle_plate, status, profile:profiles(full_name)')
    .eq('is_approved', true);

  const couriers = (couriersData || []).map((c: {
    id: string; vehicle_type: string; vehicle_plate: string; status: string;
    profile?: { full_name?: string } | null;
  }) => ({
    id: c.id,
    vehicle_type: c.vehicle_type,
    vehicle_plate: c.vehicle_plate,
    status: c.status,
    full_name: (c.profile as { full_name?: string } | null)?.full_name || '-',
  }));

  const rows = (orders || []) as OrderRow[];

  const activeStatuses = ['confirmed', 'assigning', 'assigned', 'pickup', 'in_transit'];
  const active = rows.filter(o => activeStatuses.includes(o.status));
  const pending = rows.filter(o => o.status === 'pending');
  const done = rows.filter(o => ['delivered', 'cancelled', 'failed'].includes(o.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Siparişler</h1>
          <p className="text-slate-400 text-sm mt-1">
            <span className="text-orange-400 font-medium">{active.length} aktif</span>
            {pending.length > 0 && <span className="text-yellow-400 font-medium ml-3">{pending.length} bekliyor</span>}
            <span className="text-slate-500 ml-3">{done.length} tamamlandı</span>
          </p>
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden border border-[#1e4976]/40">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e4976]/40 bg-[#0a1628]/60">
                <th className="text-left text-slate-400 font-medium px-4 py-3 whitespace-nowrap">Tarih</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Takip / Müşteri</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Alım → Teslimat</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3 text-center">Araç</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Tutar</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Durum</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Kurye</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">İptal</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className="text-center text-slate-500 py-16">Henüz sipariş yok</td></tr>
              )}
              {rows.map((order) => (
                <AdminOrderRow
                  key={order.id}
                  order={order}
                  couriers={couriers}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
