import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import AdminCourierActions from '@/components/admin/AdminCourierActions';
import type { Courier } from '@/types/database';

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-green-500/20 text-green-400 border-green-500/30',
  busy: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  offline: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};
const STATUS_LABELS: Record<string, string> = { online: 'Online', busy: 'Meşgul', offline: 'Çevrimdışı' };

export default async function AdminCouriersPage() {
  const supabase = await createClient();
  const { data: couriers } = await supabase
    .from('couriers')
    .select('*, profile:profiles!couriers_id_fkey(full_name, phone, email)')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Kuryeler</h1>
          <p className="text-slate-400 text-sm mt-1">{couriers?.length || 0} kurye kayıtlı</p>
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden border border-[#1e4976]/40">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e4976]/40">
                {['Kurye', 'Telefon', 'Araç', 'Plaka', 'Durum', 'Sipariş', 'Puan', 'Onay', 'İşlem'].map((h) => (
                  <th key={h} className="text-left text-slate-400 font-medium px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(couriers || []).map((courier: Courier & { profile: { full_name: string; phone: string } }) => (
                <tr key={courier.id} className="border-b border-[#1e4976]/20 hover:bg-[#1e4976]/10 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{courier.profile?.full_name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{courier.profile?.phone || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    {courier.vehicle_type === 'motorcycle' ? '🏍️' : courier.vehicle_type === 'car' ? '🚗' : '🚐'}
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{courier.vehicle_plate || '-'}</td>
                  <td className="px-4 py-3">
                    <Badge className={`border text-xs ${STATUS_COLORS[courier.status]}`}>
                      {STATUS_LABELS[courier.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{courier.total_orders}</td>
                  <td className="px-4 py-3 text-yellow-400 font-semibold">{courier.rating?.toFixed(1)}</td>
                  <td className="px-4 py-3">
                    <Badge className={`border text-xs ${courier.is_approved ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                      {courier.is_approved ? 'Onaylı' : 'Bekliyor'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <AdminCourierActions courier={courier as Courier} />
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
