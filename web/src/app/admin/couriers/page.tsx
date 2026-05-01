import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import AdminCourierActions from '@/components/admin/AdminCourierActions';
import AddCourierForm from '@/components/admin/AddCourierForm';
import type { Courier } from '@/types/database';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  online:  'bg-green-500/20 text-green-400 border-green-500/30',
  busy:    'bg-orange-500/20 text-orange-400 border-orange-500/30',
  offline: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};
const STATUS_LABELS: Record<string, string> = { online: 'Online', busy: 'Meşgul', offline: 'Çevrimdışı' };

type CourierRow = Courier & {
  tc_no?: string;
  home_address?: string;
  license_number?: string;
  profile_photo_url?: string;
  profile?: { full_name: string; phone: string; email: string };
};

export default async function AdminCouriersPage() {
  const supabase = await createClient();

  const { data: couriersRaw, error } = await supabase
    .from('couriers')
    .select('*, profile:profiles(full_name, phone, email)')
    .order('created_at', { ascending: false });

  if (error) console.error('[couriers page]', error);
  const couriers = (couriersRaw || []) as CourierRow[];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Kuryeler</h1>
          <p className="text-slate-400 text-sm mt-1">{couriers.length} kurye kayıtlı</p>
        </div>
      </div>

      {/* Add Courier Form */}
      <AddCourierForm />

      {/* Couriers Table */}
      <div className="glass-card rounded-xl overflow-hidden border border-[#1e4976]/40">
        <div className="px-6 py-4 border-b border-[#1e4976]/40">
          <h2 className="text-white font-semibold">Kurye Listesi</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e4976]/40">
                {['Kurye', 'Telefon', 'TC No', 'Araç', 'Plaka', 'Ruhsat', 'Durum', 'Sipariş', 'Puan', 'Onay', 'İşlem'].map((h) => (
                  <th key={h} className="text-left text-slate-400 font-medium px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {couriers.length === 0 && (
                <tr><td colSpan={11} className="text-center text-slate-500 py-12">Henüz kurye eklenmemiş</td></tr>
              )}
              {couriers.map((courier) => (
                <tr key={courier.id} className="border-b border-[#1e4976]/20 hover:bg-[#1e4976]/10 transition-colors">
                  <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{courier.profile?.full_name || '-'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{courier.profile?.phone || '-'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{courier.tc_no || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    {courier.vehicle_type === 'motorcycle' ? '🏍️' : courier.vehicle_type === 'car' ? '🚗' : '🚐'}
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{courier.vehicle_plate || '-'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{courier.license_number || '-'}</td>
                  <td className="px-4 py-3">
                    <Badge className={`border text-xs ${STATUS_COLORS[courier.status] ?? STATUS_COLORS.offline}`}>
                      {STATUS_LABELS[courier.status] ?? 'Çevrimdışı'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{courier.total_orders ?? 0}</td>
                  <td className="px-4 py-3 text-yellow-400 font-semibold">{courier.rating?.toFixed(1) ?? '5.0'}</td>
                  <td className="px-4 py-3">
                    <Badge className={`border text-xs ${courier.is_approved ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                      {courier.is_approved ? 'Onaylı' : 'Bekliyor'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <AdminCourierActions courier={courier} />
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
