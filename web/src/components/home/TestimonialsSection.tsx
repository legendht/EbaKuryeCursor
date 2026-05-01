import { Star } from 'lucide-react';

const TESTIMONIALS = [
  {
    name: 'Mehmet Yılmaz',
    company: 'Yılmaz Tekstil',
    avatar: 'MY',
    rating: 5,
    text: 'EBA Kurye ile çalışmaya başlayalı 2 yıl oldu. Kumaş numunelerimizi İstanbul\'un her yerine zamanında ve hasarsız ulaştırıyorlar. Kurye takibi sayesinde müşterimize kesin teslimat saati verebiliyoruz.',
    type: 'B2B',
    color: 'from-orange-500/10 to-transparent',
  },
  {
    name: 'Selin Kaya',
    company: 'Bireysel Müşteri',
    avatar: 'SK',
    rating: 5,
    text: 'Evrak teslimatını sabah sipariş verdim, öğleden önce karşı tarafa ulaşmıştı. Kuryeyi haritadan anlık takip etmek gerçekten güven veriyor. Fiyat da diğer seçeneklere göre çok makul.',
    type: 'B2C',
    color: 'from-blue-500/10 to-transparent',
  },
  {
    name: 'Erdem Çelik',
    company: 'Çelik Medikal A.Ş.',
    avatar: 'EÇ',
    rating: 5,
    text: 'Tıbbi malzeme teslimatlarımızda EBA Kurye\'yi kullanıyoruz. Hem kamyonet hem moto kurye seçenekleri var; ihtiyaca göre seçim yapabiliyoruz. Cari hesap sistemi de kurumsal yönetimi kolaylaştırıyor.',
    type: 'B2B',
    color: 'from-purple-500/10 to-transparent',
  },
  {
    name: 'Ayşe Demir',
    company: 'Online Butik',
    avatar: 'AD',
    rating: 5,
    text: 'E-ticaret siparişlerimi artık EBA ile gönderiyorum. Müşterim takip koduyla teslimatı izliyor, imza ile teslim garantisi çok profesyonel. Şimdiye kadar hiç kayıp olmadı.',
    type: 'B2C',
    color: 'from-green-500/10 to-transparent',
  },
  {
    name: 'Okan Arslan',
    company: 'Arslan Hukuk Bürosu',
    avatar: 'OA',
    rating: 5,
    text: 'Mahkeme belgelerini zamanında ulaştırmak kritik. EBA Kurye hiç bir kez bizi mahcup etmedi. Hukuki zorunluluk nedeniyle imzalı teslimat şartımızı eksiksiz karşılıyorlar.',
    type: 'B2B',
    color: 'from-cyan-500/10 to-transparent',
  },
  {
    name: 'Fatma Özkan',
    company: 'Bireysel Müşteri',
    avatar: 'FÖ',
    rating: 5,
    text: 'WhatsApp\'tan hemen iletişime geçtim, 10 dakikada kurye yoldaydı. Paketi güvenle teslim aldılar, aynı gün ulaştırdılar. Bu hız ve güveni başka yerde bulamadım.',
    type: 'B2C',
    color: 'from-rose-500/10 to-transparent',
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-24 bg-[#0a1628] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-2 text-sm text-orange-400 mb-4">
            <Star className="w-4 h-4 fill-orange-400" />
            Müşteri Yorumları
          </div>
          <h2 className="text-4xl font-bold text-white mb-4">
            Müşterilerimiz Ne Diyor?
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Binlerce bireysel ve kurumsal müşterimizin güveniyle hizmet veriyoruz.
          </p>
          <div className="flex items-center justify-center gap-1 mt-4">
            {[1,2,3,4,5].map(i => (
              <Star key={i} className="w-5 h-5 fill-orange-500 text-orange-500" />
            ))}
            <span className="text-white font-bold ml-2">4.9</span>
            <span className="text-slate-400 ml-1 text-sm">/ 5  ·  2000+ değerlendirme</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className={`relative glass-card rounded-2xl p-6 border border-[#1e4976]/40 overflow-hidden hover:-translate-y-1 transition-transform duration-300`}
            >
              {/* Gradient bg */}
              <div className={`absolute inset-0 bg-gradient-to-br ${t.color} opacity-60 pointer-events-none`} />

              <div className="relative space-y-4">
                {/* Stars */}
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className="w-4 h-4 fill-orange-500 text-orange-500" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-slate-300 text-sm leading-relaxed">
                  &ldquo;{t.text}&rdquo;
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-2 border-t border-[#1e4976]/40">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{t.name}</p>
                    <p className="text-slate-400 text-xs">{t.company}</p>
                  </div>
                  <div className="ml-auto">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${t.type === 'B2B' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                      {t.type}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
