import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { formatPrice, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/pricing';
import AdminOrderActions from '@/components/admin/AdminOrderActions';
import type { Order } from '@/types/database';

export default async function AdminOrdersPage() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from('orders')
    .select(`*, customer:profiles!orders_customer_id_fkey(full_name, phone), courier:couriers!orders_courier_id_fkey(vehicle_type, vehicle_plate, profile:profiles(full_name))`)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Siparişler</h1>
          <p className="text-slate-400 text-sm mt-1">{orders?.length || 0} sipariş listeleniyor</p>
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden border border-[#1e4976]/40">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e4976]/40">
                {['Takip Kodu', 'Müşteri', 'Alım', 'Teslimat', 'Araç', 'Tutar', 'Durum', 'İşlemler'].map((h) => (
                  <th key={h} className="text-left text-slate-400 font-medium px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(orders as Order[] || []).map((order) => (
                <tr key={order.id} className="border-b border-[#1e4976]/20 hover:bg-[#1e4976]/10 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-orange-400 text-xs font-semibold">{order.tracking_code}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">
                    {(order as Order & { customer: { full_name: string } }).customer?.full_name}
                  </td>
                  <td className="px-4 py-3 text-slate-300 max-w-[120px] truncate text-xs">{order.pickup_address}</td>
                  <td className="px-4 py-3 text-slate-300 max-w-[120px] truncate text-xs">{order.dropoff_address}</td>
                  <td className="px-4 py-3 text-center">
                    {order.vehicle_type === 'motorcycle' ? '🏍️' : order.vehicle_type === 'car' ? '🚗' : '🚐'}
                  </td>
                  <td className="px-4 py-3 text-white font-semibold">{formatPrice(order.total_price)}</td>
                  <td className="px-4 py-3">
                    <Badge className={`border text-xs ${ORDER_STATUS_COLORS[order.status]}`}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <AdminOrderActions order={order} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
