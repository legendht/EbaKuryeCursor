import { Shield, MapPin, TrendingUp, Users } from 'lucide-react';

export default function AboutSection() {
  return (
    <section id="hakkimizda" className="py-24 bg-[#0f2340]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left – Text */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-2 text-sm text-orange-400">
              <Users className="w-4 h-4" />
              Hakkımızda
            </div>

            <h2 className="text-4xl font-bold text-white leading-tight">
              2008'den Bu Yana<br />
              <span className="text-orange-500">Güvenilir Teslimat</span>
            </h2>

            <div className="space-y-4 text-slate-400 text-sm leading-relaxed">
              <p>
                2008 yılında moto kurye olarak başladığımız yolculuk, sahada edinilen tecrübe ve
                müşteri ihtiyaçlarına duyulan hassasiyetle kısa sürede güçlü bir vizyona dönüştü.
                Bu süreçte yolları kesişen iş ortağı <span className="text-white font-medium">Ergin Çıkrıkçı</span> ile
                birlikte, sektörde fark yaratacak bir hizmet modeli geliştirme hedefiyle yola çıkıldı.
              </p>
              <p>
                Kartal Sanayi'de temelleri atılan bu girişim, hız, güvenilirlik ve şeffaf hizmet anlayışı
                üzerine yapılan kapsamlı çalışmalar sonucunda <span className="text-orange-400 font-medium">EBA Kurye</span> markasına
                dönüştü. Kurulduğu günden bu yana, taşımacılığı sadece bir teslimat süreci olarak değil;
                planlı, kontrollü ve güvence altına alınmış bir hizmet olarak ele alıyoruz.
              </p>
              <p>
                Deneyimli kadromuz ve operasyonel gücümüzle, her gönderiyi kendi sorumluluğumuz olarak
                görüyor; hızlı ve güvenli şekilde yerine ulaştırıyoruz.
              </p>
              <p className="text-white font-semibold">
                Bugün geldiğimiz noktada, müşteri memnuniyetini merkeze alan yaklaşımımızla,
                siz değerli iş ortaklarımıza kaliteli ve sürdürülebilir bir hizmet sunmaktan gurur duyuyoruz.
              </p>
              <p className="text-orange-400 font-semibold italic">
                EBA Kurye – Hızlı Teslimat, Tam Güvence.
              </p>
            </div>
          </div>

          {/* Right – Feature cards */}
          <div className="space-y-4">
            {/* Timeline */}
            <div className="glass-card rounded-2xl p-6 border border-orange-500/20 bg-orange-500/5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl font-bold text-orange-400">16+</span>
                </div>
                <div>
                  <p className="text-white font-bold text-lg">Yıllık Deneyim</p>
                  <p className="text-slate-400 text-sm">2008'den beri İstanbul'u taşıyoruz</p>
                </div>
              </div>
            </div>

            {[
              {
                icon: <Shield className="w-6 h-6 text-green-400" />,
                bg: 'bg-green-500/10 border-green-500/20',
                title: 'Sigorta Güvencesi',
                desc: 'Tüm gönderilerinizi sigorta güvencesi altına alıyor, olası hasarlarda eksiksiz karşılıyoruz.',
              },
              {
                icon: <MapPin className="w-6 h-6 text-blue-400" />,
                bg: 'bg-blue-500/10 border-blue-500/20',
                title: 'Anlık Takip',
                desc: 'Teslimat sürecini anlık olarak takip edebilmenizi sağlıyoruz. Her aşamada bilginizdeyiz.',
              },
              {
                icon: <TrendingUp className="w-6 h-6 text-purple-400" />,
                bg: 'bg-purple-500/10 border-purple-500/20',
                title: 'Şeffaf Fiyatlandırma',
                desc: 'Gizli ücret yok. Gönderi öncesi kesin fiyat, sürpriz maliyetler olmadan teslimat.',
              },
            ].map((item) => (
              <div key={item.title} className={`glass-card rounded-2xl p-5 border ${item.bg} flex items-start gap-4`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${item.bg}`}>
                  {item.icon}
                </div>
                <div>
                  <p className="text-white font-semibold mb-1">{item.title}</p>
                  <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
