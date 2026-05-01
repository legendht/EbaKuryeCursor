import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/layout/Navbar';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/pricing';
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { AccountTransaction, Profile, CustomerAccount } from '@/types/database';

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, accountRes, transRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('customer_accounts').select('*').eq('customer_id', user.id).single(),
    supabase.from('account_transactions').select('*').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(50),
  ]);

  const profile = profileRes.data as unknown as Profile;
  const account = accountRes.data as CustomerAccount | null;
  const transactions = (transRes.data || []) as AccountTransaction[];

  const TYPE_LABELS: Record<string, string> = { debit: 'Borç', credit: 'Alacak', payment: 'Ödeme', refund: 'İade' };
  const TYPE_COLORS: Record<string, string> = {
    debit: 'bg-red-500/20 text-red-400 border-red-500/30',
    credit: 'bg-green-500/20 text-green-400 border-green-500/30',
    payment: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    refund: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };

  return (
    <main className="min-h-screen bg-[#0a1628]">
      <Navbar profile={profile} />
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-16 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Cari Hesap</h1>
          <p className="text-slate-400 text-sm mt-1">Bakiye, borç ve alacak hareketleriniz</p>
        </div>

        {/* Balance Card */}
        {account && (
          <div className="glass-card rounded-2xl p-8 border border-[#1e4976]/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Güncel Bakiye</p>
                <p className={`text-4xl font-bold mt-1 ${account.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPrice(account.balance)}
                </p>
                {account.credit_limit > 0 && (
                  <p className="text-slate-500 text-sm mt-2">Kredi Limiti: {formatPrice(account.credit_limit)}</p>
                )}
              </div>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${account.balance >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                <Wallet className={`w-8 h-8 ${account.balance >= 0 ? 'text-green-400' : 'text-red-400'}`} />
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              icon: <ArrowDownRight className="w-5 h-5 text-red-400" />,
              label: 'Toplam Borç',
              value: formatPrice(transactions.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0)),
              color: 'text-red-400',
            },
            {
              icon: <ArrowUpRight className="w-5 h-5 text-green-400" />,
              label: 'Toplam Ödeme',
              value: formatPrice(transactions.filter((t) => t.type === 'payment').reduce((s, t) => s + t.amount, 0)),
              color: 'text-green-400',
            },
          ].map((stat) => (
            <div key={stat.label} className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">{stat.icon}<span className="text-slate-400 text-xs">{stat.label}</span></div>
              <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Transactions */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#1e4976]/40">
            <h2 className="text-white font-semibold">Hesap Hareketleri</h2>
          </div>
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Henüz hareket yok</div>
          ) : (
            <div className="divide-y divide-[#1e4976]/20">
              {transactions.map((t) => (
                <div key={t.id} className="px-4 py-3 flex items-center justify-between hover:bg-[#1e4976]/10">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === 'debit' ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                      {t.type === 'debit' ? <TrendingDown className="w-4 h-4 text-red-400" /> : <TrendingUp className="w-4 h-4 text-green-400" />}
                    </div>
                    <div>
                      <p className="text-white text-sm">{t.description || TYPE_LABELS[t.type]}</p>
                      <p className="text-slate-500 text-xs">{new Date(t.created_at).toLocaleString('tr-TR')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${['debit'].includes(t.type) ? 'text-red-400' : 'text-green-400'}`}>
                      {t.type === 'debit' ? '-' : '+'}{formatPrice(t.amount)}
                    </p>
                    {t.balance_after !== null && (
                      <p className="text-slate-500 text-xs">Bakiye: {formatPrice(t.balance_after)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
