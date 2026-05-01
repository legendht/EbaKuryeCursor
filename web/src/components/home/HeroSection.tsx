'use client';

import Link from 'next/link';
import { ArrowRight, MapPin, Clock, Shield, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PriceCalculator from './PriceCalculator';

export default function HeroSection({ whatsapp = '905XXXXXXXXX' }: { whatsapp?: string }) {
  return (
    <section className="relative min-h-screen hero-gradient pt-16 overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-20 right-0 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-2 text-sm text-orange-400">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              İstanbul Genelinde Aktif Filo
            </div>

            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                <span className="text-white">Hızlı Teslimat,</span>
                <br />
                <span className="text-orange-500">Tam Güvence.</span>
              </h1>
              <p className="text-slate-400 text-lg max-w-lg leading-relaxed">
                Evraktan koliye, 100+ kurye filosuyla İstanbul'un her köşesine
                güvenli ve hızlı teslimat. Motosiklet, otomobil ve kamyonet
                seçenekleriyle ihtiyacınıza uygun çözüm.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: <MapPin className="w-5 h-5 text-orange-500" />, value: '100+', label: 'Aktif Kurye' },
                { icon: <Clock className="w-5 h-5 text-orange-500" />, value: '≤30dk', label: 'Ort. Teslim' },
                { icon: <Star className="w-5 h-5 text-orange-500" />, value: '4.9/5', label: 'Müşteri Puanı' },
              ].map((stat) => (
                <div key={stat.label} className="glass-card rounded-xl p-4 text-center">
                  <div className="flex justify-center mb-2">{stat.icon}</div>
                  <div className="text-xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-slate-400">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3">
              <Link href="/new-order">
                <Button
                  size="lg"
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 btn-orange-glow transition-all"
                >
                  Sipariş Ver <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/track">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#1e4976] text-slate-300 hover:border-orange-500 hover:text-orange-400 px-8"
                >
                  Takip Et
                </Button>
              </Link>
            </div>

            {/* Trust badges */}
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <Shield className="w-4 h-4 text-green-500" />
              <span>Kayıp & Hasar Güvencesi</span>
              <span>·</span>
              <span>7/24 Destek</span>
              <span>·</span>
              <span>Canlı Takip</span>
            </div>
          </div>

          {/* Right - Price Calculator */}
          <div>
            <PriceCalculator whatsapp={whatsapp} />
          </div>
        </div>
      </div>

      {/* Feature strips */}
      <div className="border-t border-[#1e4976]/30 bg-[#0f2340]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: '🏍️', title: 'Moto Kurye', desc: 'Evrak & Küçük Paket' },
              { icon: '🚗', title: 'Otomobil', desc: 'Orta Boy Kargo' },
              { icon: '🚐', title: 'Kamyonet', desc: 'Büyük Hacimli Yük' },
              { icon: '📍', title: 'Canlı Takip', desc: 'GPS ile Anlık İzle' },
            ].map((item) => (
              <div key={item.title} className="flex items-center gap-3">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <p className="text-white font-semibold text-sm">{item.title}</p>
                  <p className="text-slate-400 text-xs">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
