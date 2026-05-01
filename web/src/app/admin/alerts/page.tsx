import { createClient } from '@/lib/supabase/server';
import AdminMarkAlertRead from '@/components/admin/AdminMarkAlertRead';

export const dynamic = 'force-dynamic';

export default async function AdminAlertsPage() {
  const supabase = await createClient();

  const { data: alerts } = await supabase
    .from('notifications')
    .select('*, order:orders(tracking_code, pickup_address, dropoff_address, rejection_reason, rejection_count, status)')
    .eq('type', 'admin_alert')
    .order('created_at', { ascending: false })
    .limit(50);

  const unread = (alerts || []).filter((a) => !a.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Uyarılar</h1>
          <p className="text-slate-400 text-sm mt-1">
            {unread > 0 ? (
              <span className="text-red-400 font-semibold">{unread} okunmamış uyarı</span>
            ) : 'Tüm uyarılar okundu'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {(!alerts || alerts.length === 0) && (
          <div className="glass-card rounded-xl p-12 text-center text-slate-500">
            Henüz uyarı yok
          </div>
        )}

        {(alerts || []).map((alert) => {
          const order = alert.order as {
            tracking_code?: string; pickup_address?: string;
            dropoff_address?: string; rejection_reason?: string;
            rejection_count?: number; status?: string;
          } | null;

          return (
            <div
              key={alert.id}
              className={`glass-card rounded-xl p-5 border transition-all ${
                alert.is_read
                  ? 'border-[#1e4976]/30 opacity-60'
                  : 'border-red-500/40 bg-red-500/5'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    {!alert.is_read && (
                      <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                    )}
                    <span className="text-white font-semibold">{alert.title}</span>
                    <span className="text-slate-500 text-xs ml-auto">
                      {new Date(alert.created_at).toLocaleString('tr-TR')}
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm">{alert.body}</p>

                  {order && (
                    <div className="bg-[#0a1628] rounded-lg p-3 text-xs space-y-1 border border-[#1e4976]/30">
                      {order.tracking_code && (
                        <div className="flex gap-2">
                          <span className="text-slate-500">Takip:</span>
                          <span className="text-orange-400 font-mono">{order.tracking_code}</span>
                        </div>
                      )}
                      {order.pickup_address && (
                        <div className="flex gap-2">
                          <span className="text-slate-500">Alım:</span>
                          <span className="text-slate-300 truncate">{order.pickup_address}</span>
                        </div>
                      )}
                      {order.dropoff_address && (
                        <div className="flex gap-2">
                          <span className="text-slate-500">Teslimat:</span>
                          <span className="text-slate-300 truncate">{order.dropoff_address}</span>
                        </div>
                      )}
                      {order.rejection_reason && (
                        <div className="flex gap-2">
                          <span className="text-red-400">Red Sebebi:</span>
                          <span className="text-red-300">{order.rejection_reason}</span>
                        </div>
                      )}
                      {(order.rejection_count ?? 0) > 0 && (
                        <div className="flex gap-2">
                          <span className="text-slate-500">Red Sayısı:</span>
                          <span className="text-yellow-400">{order.rejection_count}x</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!alert.is_read && <AdminMarkAlertRead alertId={alert.id} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
