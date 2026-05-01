import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/pricing';
import AdminAccountActions from '@/components/admin/AdminAccountActions';
import AdminDeleteCustomer from '@/components/admin/AdminDeleteCustomer';
import AddCustomerForm from '@/components/admin/AddCustomerForm';

export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage() {
  const supabase = await createClient();
  const { data: customers, error } = await supabase
    .from('profiles')
    .select('*, account:customer_accounts(balance, credit_limit)')
    .eq('role', 'customer')
    .order('created_at', { ascending: false });

  if (error) console.error('[customers page]', error);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Müşteriler</h1>
        <p className="text-slate-400 text-sm mt-1">{customers?.length || 0} müşteri kayıtlı</p>
      </div>

      <AddCustomerForm />

      <div className="glass-card rounded-xl overflow-hidden border border-[#1e4976]/40">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e4976]/40">
                {['Ad Soyad', 'E-posta', 'Telefon', 'Tür', 'Bakiye', 'Kayıt Tarihi', 'İşlem'].map((h) => (
                  <th key={h} className="text-left text-slate-400 font-medium px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(customers || []).map((c: Record<string, unknown>) => {
                const account = (c.account as { balance: number; credit_limit: number }[] | null)?.[0];
                return (
                  <tr key={c.id as string} className="border-b border-[#1e4976]/20 hover:bg-[#1e4976]/10">
                    <td className="px-4 py-3 text-white font-medium">{c.full_name as string}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{c.email as string || '-'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{c.phone as string || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${c.is_b2b ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-400'}`}>
                        {c.is_b2b ? 'B2B' : 'B2C'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {account ? (
                        <span className={`font-semibold ${account.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatPrice(account.balance)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(c.created_at as string).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <AdminAccountActions customerId={c.id as string} currentBalance={account?.balance || 0} />
                        <AdminDeleteCustomer customerId={c.id as string} fullName={c.full_name as string} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
