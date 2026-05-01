'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Package, MapPin, Search, Loader2, CheckCircle2, Clock, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { createClient } from '@/lib/supabase/client';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, formatPrice } from '@/lib/pricing';
import { MAPBOX_TOKEN, ISTANBUL_CENTER } from '@/lib/mapbox';
import type { Order } from '@/types/database';
import Link from 'next/link';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { mapboxgl: any; }
}

function TrackingMap({ order, courierLat, courierLng }: { order: Order; courierLat: number | null; courierLng: number | null }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const mapboxgl = window.mapboxgl;
    if (!mapboxgl) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [order.pickup_lng, order.pickup_lat],
      zoom: 13,
    });
    mapRef.current = map;

    map.on('load', () => {
      // Pickup marker
      const pickupEl = document.createElement('div');
      pickupEl.className = 'w-8 h-8 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow-lg';
      pickupEl.textContent = 'A';
      markersRef.current.pickup = new mapboxgl.Marker({ element: pickupEl })
        .setLngLat([order.pickup_lng, order.pickup_lat])
        .setPopup(new mapboxgl.Popup().setText('Alım: ' + order.pickup_address))
        .addTo(map);

      // Dropoff marker
      const dropEl = document.createElement('div');
      dropEl.className = 'w-8 h-8 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow-lg';
      dropEl.textContent = 'B';
      markersRef.current.dropoff = new mapboxgl.Marker({ element: dropEl })
        .setLngLat([order.dropoff_lng, order.dropoff_lat])
        .setPopup(new mapboxgl.Popup().setText('Teslimat: ' + order.dropoff_address))
        .addTo(map);

      map.fitBounds([[
        Math.min(order.pickup_lng, order.dropoff_lng) - 0.01,
        Math.min(order.pickup_lat, order.dropoff_lat) - 0.01,
      ], [
        Math.max(order.pickup_lng, order.dropoff_lng) + 0.01,
        Math.max(order.pickup_lat, order.dropoff_lat) + 0.01,
      ]], { padding: 60 });
    });

    return () => { map.remove(); mapRef.current = null; };
  }, [order]);

  // Update courier marker
  useEffect(() => {
    const map = mapRef.current as { addTo?: (m: unknown) => void } | null;
    if (!map || !courierLat || !courierLng) return;
    const mapboxgl = window.mapboxgl;
    if (!mapboxgl) return;

    if (markersRef.current.courier) {
      (markersRef.current.courier as { setLngLat: (c: [number, number]) => void }).setLngLat([courierLng, courierLat]);
    } else {
      const el = document.createElement('div');
      el.className = 'w-10 h-10 bg-green-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg animate-pulse';
      el.innerHTML = '<span style="font-size:18px">🏍️</span>';
      const mapboxMap = mapRef.current as { addTo?: unknown } & { project?: unknown };
      markersRef.current.courier = new mapboxgl.Marker({ element: el })
        .setLngLat([courierLng, courierLat])
        .setPopup(new mapboxgl.Popup().setText('Kurye'))
        .addTo(mapboxMap as Parameters<typeof mapboxgl.Marker.prototype.addTo>[0]);
    }
  }, [courierLat, courierLng]);

  return (
    <div ref={mapContainer} className="w-full h-80 rounded-xl overflow-hidden border border-[#1e4976]/40" />
  );
}

function TrackPage() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [inputCode, setInputCode] = useState(searchParams.get('code') || '');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [courierLat, setCourierLat] = useState<number | null>(null);
  const [courierLng, setCourierLng] = useState<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Load mapboxgl
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const fetchOrder = async (trackCode: string) => {
    if (!trackCode) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('tracking_code', trackCode)
      .single();
    setOrder(data as Order | null);
    if (data?.courier_id) {
      const { data: courier } = await supabase
        .from('couriers')
        .select('current_lat, current_lng')
        .eq('id', data.courier_id)
        .single();
      if (courier) { setCourierLat(courier.current_lat); setCourierLng(courier.current_lng); }
    }
    setLoading(false);
  };

  useEffect(() => { if (code) fetchOrder(code); }, [code]);

  // Socket.io live tracking
  useEffect(() => {
    if (!code || !order) return;
    const socket = connectSocket();
    socket.emit('order:track', { trackingCode: code });
    socket.on('courier:location:update', (data) => {
      setCourierLat(data.lat);
      setCourierLng(data.lng);
    });
    socket.on('order:status:changed', ({ status }) => {
      setOrder((prev) => prev ? { ...prev, status } : prev);
    });
    return () => {
      socket.off('courier:location:update');
      socket.off('order:status:changed');
    };
  }, [code, order]);

  const steps = [
    { key: 'confirmed', label: 'Onaylandı', icon: <CheckCircle2 className="w-4 h-4" /> },
    { key: 'assigned', label: 'Kurye Atandı', icon: <Truck className="w-4 h-4" /> },
    { key: 'pickup', label: 'Paket Alındı', icon: <Package className="w-4 h-4" /> },
    { key: 'in_transit', label: 'Yolda', icon: <MapPin className="w-4 h-4" /> },
    { key: 'delivered', label: 'Teslim Edildi', icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  const currentStep = steps.findIndex((s) => s.key === order?.status);

  return (
    <main className="min-h-screen bg-[#0a1628]">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a1628]/90 backdrop-blur-md border-b border-[#1e4976]/40">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold"><span className="text-white">EBA</span><span className="text-orange-500"> Kurye</span></span>
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 pt-24 pb-16 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Sipariş Takibi</h1>
          <p className="text-slate-400 text-sm mt-1">Takip kodunuzu girerek siparişinizi canlı izleyin</p>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              className="pl-9 bg-[#0f2340]/80 border-[#1e4976]/60 text-white placeholder:text-slate-500 focus:border-orange-500 font-mono uppercase"
              placeholder="EBA-XXXXXXXX"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && setCode(inputCode)}
            />
          </div>
          <Button
            onClick={() => setCode(inputCode)}
            disabled={loading}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sorgula'}
          </Button>
        </div>

        {/* Order Info */}
        {order && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-orange-400 font-bold text-lg">{order.tracking_code}</span>
                <Badge className={`border ${ORDER_STATUS_COLORS[order.status]}`}>
                  {ORDER_STATUS_LABELS[order.status]}
                </Badge>
              </div>

              {/* Progress Steps */}
              {!['cancelled', 'failed'].includes(order.status) && (
                <div className="flex items-center justify-between">
                  {steps.map((step, idx) => (
                    <div key={step.key} className="flex items-center">
                      <div className={`flex flex-col items-center gap-1 ${idx <= currentStep ? 'text-orange-500' : 'text-slate-600'}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center border ${idx <= currentStep ? 'border-orange-500 bg-orange-500/20' : 'border-slate-600'}`}>
                          {step.icon}
                        </div>
                        <span className="text-xs hidden sm:block">{step.label}</span>
                      </div>
                      {idx < steps.length - 1 && (
                        <div className={`h-0.5 w-6 sm:w-10 mx-1 ${idx < currentStep ? 'bg-orange-500' : 'bg-slate-700'}`} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Alım Adresi</p>
                  <p className="text-slate-300 mt-1">{order.pickup_address}</p>
                </div>
                <div>
                  <p className="text-slate-500">Teslimat Adresi</p>
                  <p className="text-slate-300 mt-1">{order.dropoff_address}</p>
                </div>
                <div>
                  <p className="text-slate-500">Mesafe</p>
                  <p className="text-white font-semibold">{order.distance_km?.toFixed(1)} km</p>
                </div>
                <div>
                  <p className="text-slate-500">Tutar</p>
                  <p className="text-orange-500 font-bold">{formatPrice(order.total_price)}</p>
                </div>
              </div>
            </div>

            {/* Live Map */}
            {mapLoaded && ['assigned', 'pickup', 'in_transit'].includes(order.status) && (
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <p className="text-white font-semibold text-sm">Canlı Takip</p>
                </div>
                <TrackingMap order={order} courierLat={courierLat} courierLng={courierLng} />
              </div>
            )}

            {/* Delivery Proof */}
            {order.status === 'delivered' && (order.delivery_photo_url || order.delivery_signature_url) && (
              <div className="glass-card rounded-2xl p-6 space-y-3">
                <h3 className="text-white font-semibold">Teslimat Kanıtı</h3>
                <div className="flex gap-4">
                  {order.delivery_photo_url && (
                    <div>
                      <p className="text-slate-400 text-xs mb-2">Teslimat Fotoğrafı</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={order.delivery_photo_url} alt="Teslimat" className="w-32 h-32 object-cover rounded-lg border border-[#1e4976]/60" />
                    </div>
                  )}
                  {order.delivery_signature_url && (
                    <div>
                      <p className="text-slate-400 text-xs mb-2">İmza</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={order.delivery_signature_url} alt="İmza" className="w-32 h-32 object-cover rounded-lg border border-[#1e4976]/60 bg-white" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {!order && !loading && code && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Sipariş bulunamadı: <span className="text-orange-400 font-mono">{code}</span></p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function TrackPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a1628] flex items-center justify-center"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>}>
      <TrackPage />
    </Suspense>
  );
}
