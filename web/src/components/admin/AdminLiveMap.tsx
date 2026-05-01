'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Map as MapboxGlMap, Marker as MapMarker } from 'mapbox-gl';
import { createClient } from '@/lib/supabase/client';
import { MAPBOX_TOKEN, ISTANBUL_CENTER } from '@/lib/mapbox';
import { io, Socket } from 'socket.io-client';

interface CourierLocation {
  courierId: string;
  lat: number;
  lng: number;
  heading?: number;
  vehicleType?: string;
  fullName?: string;
  status?: string;
}

interface AdminLiveMapProps {
  height?: number;
  mini?: boolean;
}

const VEHICLE_EMOJI: Record<string, string> = {
  motorcycle: '🏍️',
  car: '🚗',
  van: '🚐',
};

const STATUS_COLOR: Record<string, string> = {
  online: '#22c55e',
  break: '#eab308',
  busy: '#f97316',
  offline: '#64748b',
};

export default function AdminLiveMap({ height = 600, mini = false }: AdminLiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxGlMap | null>(null);
  const mapboxRef = useRef<typeof import('mapbox-gl').default | null>(null);
  const markersRef = useRef<Map<string, MapMarker>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const courierMetaRef = useRef<Map<string, { vehicleType: string; fullName: string; status: string }>>(new Map());
  const [mapLibReady, setMapLibReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [courierCount, setCourierCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!MAPBOX_TOKEN) {
        if (!cancelled) setMapError('Mapbox anahtarı tanımlı değil (NEXT_PUBLIC_MAPBOX_TOKEN).');
        return;
      }
      try {
        await import('mapbox-gl/dist/mapbox-gl.css');
        const mapboxgl = (await import('mapbox-gl')).default;
        if (cancelled) return;
        mapboxRef.current = mapboxgl;
        setMapLibReady(true);
      } catch {
        if (!cancelled) setMapError('Harita kütüphanesi yüklenemedi. Tarayıcı ağı veya CSP engeli olabilir.');
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = mapContainer.current;
    if (!mapLibReady || !el || mapError || mapRef.current || !mapboxRef.current) return;

    const mapboxgl = mapboxRef.current;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    try {
      const map = new mapboxgl.Map({
        container: el,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: ISTANBUL_CENTER,
        zoom: mini ? 10 : 11,
      });
      mapRef.current = map;

      map.on('error', (e) => {
        const err = e?.error as { message?: string } | undefined;
        const msg =
          typeof err?.message === 'string' ? err.message : 'Harita stili veya bağlantı hatası.';
        setMapError(msg);
      });

      map.on('load', () => setMapReady(true));

      if (!mini) {
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
      }
    } catch (e) {
      setMapError(e instanceof Error ? e.message : 'Harita oluşturulamadı.');
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [mapLibReady, mini, mapError]);

  const updateCourierMarker = useCallback((loc: CourierLocation) => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) return;

    const meta = courierMetaRef.current.get(loc.courierId);
    const vehicleType = loc.vehicleType || meta?.vehicleType || 'motorcycle';
    const status = loc.status || meta?.status || 'online';
    const fullName = loc.fullName || meta?.fullName || 'Kurye';

    const emoji = VEHICLE_EMOJI[vehicleType] ?? '🏍️';
    const borderColor = STATUS_COLOR[status] ?? '#22c55e';

    if (markersRef.current.has(loc.courierId)) {
      const marker = markersRef.current.get(loc.courierId)!;
      marker.setLngLat([loc.lng, loc.lat]);
      const htmlEl = marker.getElement();
      if (htmlEl) htmlEl.style.borderColor = borderColor;
    } else {
      const markerEl = document.createElement('div');
      markerEl.style.cssText = [
        'width:40px', 'height:40px', 'background:#0f2340',
        `border:2.5px solid ${borderColor}`, 'border-radius:50%',
        'display:flex', 'align-items:center', 'justify-content:center',
        'font-size:20px', `box-shadow:0 0 10px ${borderColor}60`,
        'cursor:pointer', 'transition:border-color 0.3s',
      ].join(';');
      markerEl.innerHTML = emoji;

      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
        .setHTML(`<div style="color:#0a1628;font-size:12px;font-weight:600">${fullName}<br/>${status}</div>`);

      const marker = new mapboxgl.Marker({ element: markerEl })
        .setLngLat([loc.lng, loc.lat])
        .setPopup(popup)
        .addTo(map);

      markerEl.addEventListener('mouseenter', () => marker.togglePopup());
      markerEl.addEventListener('mouseleave', () => marker.togglePopup());

      markersRef.current.set(loc.courierId, marker);
    }
    setCourierCount(markersRef.current.size);
    setLastUpdate(new Date());
  }, []);

  const fetchCourierMeta = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('couriers')
      .select('id, vehicle_type, status, profile:profiles(full_name)')
      .in('status', ['online', 'busy', 'break']);
    if (data) {
      data.forEach((c) => {
        courierMetaRef.current.set(c.id, {
          vehicleType: c.vehicle_type,
          status: c.status,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fullName: (c.profile as any)?.full_name ?? 'Kurye',
        });
      });
    }
    return data;
  }, []);

  const removeMarker = useCallback((courierId: string) => {
    if (markersRef.current.has(courierId)) {
      markersRef.current.get(courierId)!.remove();
      markersRef.current.delete(courierId);
      setCourierCount(markersRef.current.size);
    }
  }, []);

  useEffect(() => {
    if (!mapReady) return;

    const supabase = createClient();

    const connectSocket = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetchCourierMeta();

      const socketUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SOCKET_URL || '');
      const socket = io(socketUrl, {
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setConnected(true);
        socket.emit('admin:join:tracking', { token: session.access_token });
      });

      socket.on('disconnect', () => setConnected(false));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.on('admin:tracking:snapshot', (snapshot: Record<string, any>) => {
        Object.entries(snapshot).forEach(([courierId, loc]) => {
          if (loc?.lat && loc?.lng) {
            updateCourierMarker({ courierId, lat: loc.lat, lng: loc.lng, heading: loc.heading });
          }
        });
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.on('courier:location:update', (data: any) => {
        const { courierId, lat, lng, heading } = data;
        if (lat && lng) {
          updateCourierMarker({ courierId, lat, lng, heading });
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.on('courier:status:update', (data: any) => {
        const { courierId, status } = data;
        const meta = courierMetaRef.current.get(courierId);
        if (meta) {
          meta.status = status;
          courierMetaRef.current.set(courierId, meta);
        }
        if (status === 'offline') {
          removeMarker(courierId);
        } else if (markersRef.current.has(courierId)) {
          const marker = markersRef.current.get(courierId)!;
          const el = marker.getElement();
          if (el) el.style.borderColor = STATUS_COLOR[status] ?? '#64748b';
        }
      });
    };

    connectSocket();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [mapReady, updateCourierMarker, removeMarker, fetchCourierMeta]);

  const loading = mapLibReady && !mapReady && !mapError;

  return (
    <div className="relative">
      <div ref={mapContainer} style={{ height: `${height}px`, width: '100%' }} className={mapError ? 'bg-[#0a1628]' : undefined} />

      {!mapLibReady && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a1628] z-10">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Harita yükleniyor...</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a1628]/70 z-[5] pointer-events-none">
          <div className="text-center pointer-events-auto">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Stil ve karo yükleniyor...</p>
          </div>
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a1628] z-10 p-4">
          <p className="text-red-400 text-sm text-center max-w-md">{mapError}</p>
        </div>
      )}

      <div className="absolute top-3 left-3 bg-[#0f2340]/90 backdrop-blur-sm border border-[#1e4976]/60 rounded-lg px-3 py-2 text-xs text-slate-300 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span>{courierCount} aktif kurye</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-slate-500">{connected ? 'Canlı' : 'Bağlanıyor...'}</span>
        </div>
        {lastUpdate && (
          <span className="text-slate-500">
            {lastUpdate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {!mini && (
        <div className="absolute bottom-6 left-3 bg-[#0f2340]/90 backdrop-blur-sm border border-[#1e4976]/60 rounded-lg px-3 py-2 text-xs text-slate-300 flex flex-col gap-1.5">
          {[
            { color: '#22c55e', label: 'Online' },
            { color: '#eab308', label: 'Mola' },
            { color: '#f97316', label: 'Meşgul' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
