import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/pricing';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AdminCustomerAccountForm from '@/components/admin/AdminCustomerAccountForm';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

const TX_LABEL: Record<string, string> = {
  payment: 'Ödeme Alındı',
  credit: 'Alacak',
  debit: 'Borç',
  refund: 'İade',
  deposit: 'Bakiye Yükleme',
  adjustment: 'Düzeltme',
  charge: 'Sipariş Ödemesi',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Beklemede', confirmed: 'Onaylandı', assigning: 'Aranıyor',
  assigned: 'Atandı', pickup: 'Alındı', in_transit: 'Yolda',
  delivered: 'Teslim', cancelled: 'İptal', failed: 'Başarısız',
};

export default async function AdminCustomerDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from('profiles')
    .select('*, account:customer_accounts(balance, credit_limit, discount_rate)')
    .eq('id', id)
    .eq('role', 'customer')
    .single();

  if (!customer) return notFound();

  const account = (customer.account as { balance: number; credit_limit: number; discount_rate: number }[] | null)?.[0]
    ?? { balance: 0, credit_limit: 0, discount_rate: 0 };

  const { data: orders } = await supabase
    .from('orders')
    .select('id, tracking_code, status, total_price, discount_amount, paid_from_balance, created_at, pickup_address, dropoff_address')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: transactions } = await supabase
    .from('account_transactions')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  const ordersCount = orders?.length ?? 0;
  const totalSpent = (orders ?? [])
    .filter(o => o.status === 'delivered')
    .reduce((s, o) => s + Number(o.total_price), 0);

  return (
    <div className="space-y-6">
      <Link href="/admin/customers" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-orange-400">
        <ArrowLeft className="w-4 h-4" /> Müşteri Listesine Dön
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol: Müşteri bilgileri */}
        <div className="glass-card rounded-xl border border-[#1e4976]/40 p-5 space-y-3">
          <h2 className="text-lg font-bold text-white mb-2">Müşteri Bilgileri</h2>
          <Field label="Ad Soyad" value={customer.full_name} />
          <Field label="E-posta" value={customer.email} />
          <Field label="Telefon" value={customer.phone} />
          <Field label="Tür" value={customer.is_b2b ? 'B2B (Kurumsal)' : 'B2C (Bireysel)'} />
          {customer.is_b2b && (
            <>
              <Field label="Firma" value={customer.company_name} />
              <Field label="Vergi No" value={customer.tax_number} />
            </>
          )}
          <Field label="Adres" value={customer.address} />
          <Field label="Kayıt Tarihi" value={new Date(customer.created_at).toLocaleDateString('tr-TR')} />
        </div>

        {/* Orta: Cari kartı */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              label="Ön Ödeme Bakiyesi"
              value={formatPrice(account.balance)}
              color={account.balance >= 0 ? 'text-green-400' : 'text-red-400'}
            />
            <StatCard
              label="Özel İndirim Oranı"
              value={`%${Number(account.discount_rate).toFixed(1)}`}
              color="text-orange-400"
            />
            <StatCard
              label="Toplam Sipariş / Harcama"
              value={`${ordersCount} · ${formatPrice(totalSpent)}`}
              color="text-blue-400"
            />
          </div>

          <div className="glass-card rounded-xl border border-[#1e4976]/40 p-5">
            <h3 className="text-md font-bold text-white mb-3">Cari Hesap Güncelle</h3>
            <AdminCustomerAccountForm
              customerId={id}
              currentBalance={account.balance}
              currentDiscountRate={account.discount_rate}
            />
          </div>
        </div>
      </div>

      {/* Cari hareketleri */}
      <div className="glass-card rounded-xl border border-[#1e4976]/40 overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1e4976]/40 bg-[#0a1628]/60">
          <h3 className="text-md font-bold text-white">Cari Hareketleri</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e4976]/40">
                {['Tarih', 'İşlem', 'Tutar', 'Bakiye Sonrası', 'Açıklama'].map(h => (
                  <th key={h} className="text-left text-slate-400 font-medium px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(!transactions || transactions.length === 0) && (
                <tr><td colSpan={5} className="text-center text-slate-500 py-8">Henüz işlem yok</td></tr>
              )}
              {(transactions ?? []).map(tx => (
                <tr key={tx.id as string} className="border-b border-[#1e4976]/20 hover:bg-[#1e4976]/10">
                  <td className="px-4 py-2 text-slate-500 text-xs">
                    {new Date(tx.created_at as string).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-2 text-slate-300">{TX_LABEL[tx.type as string] ?? tx.type}</td>
                  <td className={`px-4 py-2 font-semibold ${Number(tx.amount) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {Number(tx.amount) >= 0 ? '+' : ''}{formatPrice(Number(tx.amount))}
                  </td>
                  <td className="px-4 py-2 text-slate-400">{formatPrice(Number(tx.balance_after))}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{(tx.description as string) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sipariş geçmişi */}
      <div className="glass-card rounded-xl border border-[#1e4976]/40 overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1e4976]/40 bg-[#0a1628]/60">
          <h3 className="text-md font-bold text-white">Sipariş Geçmişi</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e4976]/40">
                {['Tarih', 'Takip', 'Güzergah', 'Durum', 'Tutar', 'Ödeme'].map(h => (
                  <th key={h} className="text-left text-slate-400 font-medium px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(!orders || orders.length === 0) && (
                <tr><td colSpan={6} className="text-center text-slate-500 py-8">Henüz sipariş yok</td></tr>
              )}
              {(orders ?? []).map(o => (
                <tr key={o.id} className="border-b border-[#1e4976]/20 hover:bg-[#1e4976]/10">
                  <td className="px-4 py-2 text-slate-500 text-xs">
                    {new Date(o.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </td>
                  <td className="px-4 py-2 font-mono text-orange-400 text-xs">{o.tracking_code}</td>
                  <td className="px-4 py-2 text-slate-400 text-xs max-w-[280px] truncate">
                    {o.pickup_address.split(',')[0]} → {o.dropoff_address.split(',')[0]}
                  </td>
                  <td className="px-4 py-2 text-slate-300 text-xs">{STATUS_LABEL[o.status] ?? o.status}</td>
                  <td className="px-4 py-2 text-white font-semibold">{formatPrice(Number(o.total_price))}</td>
                  <td className="px-4 py-2 text-xs">
                    {o.paid_from_balance ? (
                      <span className="text-green-400">✓ Bakiye</span>
                    ) : (
                      <span className="text-slate-500">Nakit/Kart</span>
                    )}
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

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-slate-500 text-xs">{label}</p>
      <p className="text-slate-200 text-sm">{value || '—'}</p>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="glass-card rounded-xl border border-[#1e4976]/40 p-4">
      <p className="text-slate-500 text-xs mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
