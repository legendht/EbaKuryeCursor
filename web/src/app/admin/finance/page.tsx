import { Wrench } from 'lucide-react';

export default function AdminFinancePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="w-20 h-20 bg-orange-500/10 border border-orange-500/30 rounded-2xl flex items-center justify-center">
        <Wrench className="w-10 h-10 text-orange-400" />
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">Yapım Aşamasında</h1>
        <p className="text-slate-400 text-sm max-w-sm">
          Finans modülü çok yakında burada olacak. Ciro raporları, kurye ödemeleri ve fatura yönetimi bu bölümde yer alacak.
        </p>
      </div>
      <div className="flex gap-3 text-xs text-slate-600">
        <span className="px-3 py-1 border border-[#1e4976]/40 rounded-full">Ciro Raporları</span>
        <span className="px-3 py-1 border border-[#1e4976]/40 rounded-full">Kurye Ödemeleri</span>
        <span className="px-3 py-1 border border-[#1e4976]/40 rounded-full">Fatura Yönetimi</span>
      </div>
    </div>
  );
}
