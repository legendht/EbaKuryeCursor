import AdminLiveMap from '@/components/admin/AdminLiveMap';

export default function AdminMapPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Filo Canlı Harita</h1>
        <p className="text-slate-400 text-sm mt-1">Tüm kuryeler Socket.io üzerinden anlık izleniyor</p>
      </div>
      <div className="glass-card rounded-xl overflow-hidden border border-[#1e4976]/40">
        <AdminLiveMap height={700} />
      </div>
    </div>
  );
}
