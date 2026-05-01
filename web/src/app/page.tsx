import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/layout/Navbar';
import HeroSection from '@/components/home/HeroSection';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import { Shield, Zap, MapPin, Clock, Star, Phone, Mail, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

async function getSettings() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', ['whatsapp_number']);
  return data?.reduce<Record<string, string>>((acc, s) => ({ ...acc, [s.key]: s.value }), {}) || {};
}

async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return data;
}

export default async function HomePage() {
  const [settings, profile] = await Promise.all([getSettings(), getProfile()]);
  const whatsapp = settings.whatsapp_number || '905XXXXXXXXX';

  return (
    <main className="min-h-screen">
      <Navbar profile={profile} />
      <HeroSection />

      {/* Services Section */}
      <section id="services" className="py-24 bg-[#0a1628]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Hizmetlerimiz</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              İhtiyacınıza göre doğru araç, doğru hizmet. Her boyutta kargo için çözümümüz var.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: '🏍️',
                title: 'Moto Kurye',
                subtitle: 'Evrak & Küçük Kargo',
                desc: 'Trafiği aşan hız. Evrak, küçük paket ve acil teslimatlar için ideal. 0-10 kg.',
                color: 'from-orange-500/20 to-orange-500/5',
                border: 'border-orange-500/30',
                price: '30₺\'den başlayan fiyatlarla',
              },
              {
                icon: '🚗',
                title: 'Otomobil Kurye',
                subtitle: 'Orta Boy Kargo',
                desc: 'Orta hacimli kutular, dayanıklı ürünler ve dikkatli taşıma gerektiren karolar. 10-75 kg.',
                color: 'from-blue-500/20 to-blue-500/5',
                border: 'border-blue-500/30',
                price: '50₺\'den başlayan fiyatlarla',
              },
              {
                icon: '🚐',
                title: 'Kamyonet',
                subtitle: 'Büyük Hacimli Yük',
                desc: 'Mobilya, beyaz eşya, büyük kargo ve kurumsal lojistik ihtiyaçları. 75 kg üzeri.',
                color: 'from-purple-500/20 to-purple-500/5',
                border: 'border-purple-500/30',
                price: '80₺\'den başlayan fiyatlarla',
              },
            ].map((service) => (
              <div
                key={service.title}
                className={`relative glass-card rounded-2xl p-8 border ${service.border} overflow-hidden group hover:-translate-y-1 transition-transform duration-300`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-50`} />
                <div className="relative">
                  <span className="text-5xl">{service.icon}</span>
                  <h3 className="text-xl font-bold text-white mt-4">{service.title}</h3>
                  <p className="text-orange-400 text-sm font-medium">{service.subtitle}</p>
                  <p className="text-slate-400 mt-3 text-sm leading-relaxed">{service.desc}</p>
                  <p className="text-slate-500 mt-4 text-xs">{service.price}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Us */}
      <section className="py-24 bg-[#0f2340]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Neden EBA Kurye?</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <Zap className="w-8 h-8 text-orange-500" />, title: 'Ultra Hızlı', desc: 'Akıllı atama ile ortalama 30 dakika içinde teslimat' },
              { icon: <Shield className="w-8 h-8 text-orange-500" />, title: 'Tam Sigorta', desc: 'Tüm teslimatlar hasar ve kayıp güvencesi kapsamında' },
              { icon: <MapPin className="w-8 h-8 text-orange-500" />, title: 'Canlı Takip', desc: 'Kuryenizi harita üzerinde anlık takip edin' },
              { icon: <Clock className="w-8 h-8 text-orange-500" />, title: '7/24 Hizmet', desc: 'Sabah erkeninden gece geç saate kadar aktif filo' },
            ].map((item) => (
              <div key={item.title} className="glass-card rounded-xl p-6 text-center hover:-translate-y-1 transition-transform duration-300">
                <div className="flex justify-center mb-4">{item.icon}</div>
                <h3 className="text-white font-bold mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-[#0a1628]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Şeffaf Fiyatlandırma</h2>
            <p className="text-slate-400">Gizli ücret yok. Hesap yap, karar ver.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { type: '🏍️ Motosiklet', base: '30₺', per_km: '5₺/km', range: '0 – 10 kg', highlight: false },
              { type: '🚗 Otomobil', base: '50₺', per_km: '8₺/km', range: '10 – 75 kg', highlight: true },
              { type: '🚐 Kamyonet', base: '80₺', per_km: '12₺/km', range: '75 kg +', highlight: false },
            ].map((p) => (
              <div
                key={p.type}
                className={`rounded-2xl p-8 ${p.highlight
                  ? 'bg-orange-500 shadow-2xl shadow-orange-500/20 scale-105'
                  : 'glass-card border border-[#1e4976]/40'
                  }`}
              >
                <p className={`text-lg font-bold mb-4 ${p.highlight ? 'text-white' : 'text-white'}`}>{p.type}</p>
                <div className={`text-4xl font-bold mb-1 ${p.highlight ? 'text-white' : 'text-orange-500'}`}>{p.base}</div>
                <p className={`text-sm mb-1 ${p.highlight ? 'text-orange-100' : 'text-slate-400'}`}>Açılış Ücreti</p>
                <p className={`text-2xl font-semibold mt-4 mb-1 ${p.highlight ? 'text-white' : 'text-white'}`}>{p.per_km}</p>
                <p className={`text-sm mb-4 ${p.highlight ? 'text-orange-100' : 'text-slate-400'}`}>Kilometre Ücreti</p>
                <div className={`text-xs px-3 py-1 rounded-full inline-block ${p.highlight ? 'bg-white/20 text-white' : 'bg-[#1e4976]/40 text-slate-300'}`}>
                  {p.range}
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-slate-500 text-sm mt-8">
            * Fiyatlar Mapbox canlı trafik verisiyle hesaplanır. Admin panelinden dinamik olarak güncellenebilir.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-[#0f2340]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Hemen Başlayın
          </h2>
          <p className="text-slate-400 mb-10 text-lg">
            Ücretsiz üyelikle tüm avantajlardan yararlanın. Cari hesap, fatura ve daha fazlası.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-10 btn-orange-glow">
                Ücretsiz Üye Ol <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            </Link>
            <a
              href={`https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Merhaba, bilgi almak istiyorum.')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" variant="outline" className="border-[#1e4976] text-slate-300 hover:border-green-500 hover:text-green-400 px-10">
                <span className="mr-2">💬</span> WhatsApp ile İletişim
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-16 bg-[#0a1628] border-t border-[#1e4976]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {[
              { icon: <Phone className="w-6 h-6 text-orange-500 mx-auto" />, title: 'Telefon', value: whatsapp },
              { icon: <Mail className="w-6 h-6 text-orange-500 mx-auto" />, title: 'E-posta', value: 'info@ebakurye.com' },
              { icon: <MapPin className="w-6 h-6 text-orange-500 mx-auto" />, title: 'Adres', value: 'İstanbul, Türkiye' },
            ].map((c) => (
              <div key={c.title}>
                {c.icon}
                <p className="text-white font-semibold mt-2">{c.title}</p>
                <p className="text-slate-400 text-sm mt-1">{c.value}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12 text-slate-600 text-sm">
            © 2026 EBA Kurye. Tüm hakları saklıdır.
          </div>
        </div>
      </section>

      <WhatsAppButton phoneNumber={whatsapp} />
    </main>
  );
}
