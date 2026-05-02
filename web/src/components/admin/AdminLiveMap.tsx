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

interface ActiveOrder {
  pickup_address: string;
  dropoff_address: string;
  updated_at: string;
  status: string;
}

interface CourierMeta {
  vehicleType: string;
  fullName: string;
  status: string;
  break_reason?: string;
  break_started_at?: string;
  current_lat?: number;
  current_lng?: number;
  activeOrder?: ActiveOrder;
}

interface CourierListItem {
  id: string;
  name: string;
  status: string;
  vehicleType: string;
  color: string;
  statusChangedAt: string; // ISO – durum kaç dakika önce değişti
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

const COURIER_COLORS = [
  '#f97316', '#3b82f6', '#a855f7', '#ec4899', '#06b6d4',
  '#84cc16', '#f59e0b', '#14b8a6', '#ef4444', '#8b5cf6',
];

const STATUS_COLOR: Record<string, string> = {
  online: '#22c55e',
  break: '#eab308',
  busy: '#3b82f6',
  offline: '#64748b',
};

const STATUS_LABEL: Record<string, string> = {
  online: 'Online',
  break: 'Mola',
  busy: 'Siparişte',
  offline: 'Offline',
};

const STATUS_TEXT_CLASS: Record<string, string> = {
  online: 'text-green-400',
  break: 'text-yellow-400',
  busy: 'text-blue-400',
  offline: 'text-slate-500',
};

export default function AdminLiveMap({ height = 600, mini = false }: AdminLiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxGlMap | null>(null);
  const mapboxRef = useRef<typeof import('mapbox-gl').default | null>(null);
  const markersRef = useRef<Map<string, MapMarker>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const courierMetaRef = useRef<Map<string, CourierMeta>>(new Map());
  const courierColorRef = useRef<Map<string, string>>(new Map());
  const colorIndexRef = useRef(0);

  const [mapLibReady, setMapLibReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [courierCount, setCourierCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [courierList, setCourierList] = useState<CourierListItem[]>([]);
  // tick dakikada bir değişir → durum süresi hesabını yeniden render eder
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const getOrAssignColor = useCallback((courierId: string) => {
    if (!courierColorRef.current.has(courierId)) {
      const color = COURIER_COLORS[colorIndexRef.current % COURIER_COLORS.length];
      colorIndexRef.current++;
      courierColorRef.current.set(courierId, color);
    }
    return courierColorRef.current.get(courierId)!;
  }, []);

  const buildPopupHtml = useCallback((courierId: string, vehicleType: string) => {
    const meta = courierMetaRef.current.get(courierId);
    const status = meta?.status ?? 'online';
    const fullName = meta?.fullName ?? 'Kurye';
    const emoji = VEHICLE_EMOJI[vehicleType] ?? '🏍️';
    const statusColor = STATUS_COLOR[status] ?? '#888';
    const statusText = STATUS_LABEL[status] ?? status;

    let html = `
      <div style="color:#0f172a;font-size:12px;min-width:170px;font-family:sans-serif;padding:2px">
        <p style="font-weight:700;font-size:13px;margin:0 0 4px">${emoji} ${fullName}</p>
        <p style="color:${statusColor};font-weight:600;margin:0 0 4px">● ${statusText}</p>`;

    if (status === 'break') {
      if (meta?.break_reason) {
        html += `<p style="margin:2px 0">☕ ${meta.break_reason}</p>`;
      }
      if (meta?.break_started_at) {
        const mins = Math.round((Date.now() - new Date(meta.break_started_at).getTime()) / 60000);
        html += `<p style="color:#64748b;margin:2px 0">${mins} dakikadır molada</p>`;
      }
    }

    if (status === 'offline') {
      html += `<p style="color:#64748b;margin:2px 0">Son bilinen konum</p>`;
    }

    if (meta?.activeOrder) {
      const order = meta.activeOrder;
      const pickupArea = order.pickup_address.split(',')[0].trim();
      const dropoffArea = order.dropoff_address.split(',')[0].trim();
      const statusLabel = order.status === 'pickup' ? 'Paket alındı' : 'Yolda';
      const elapsed = order.updated_at
        ? Math.round((Date.now() - new Date(order.updated_at).getTime()) / 60000)
        : null;

      html += `
        <hr style="border:none;border-top:1px solid #cbd5e1;margin:6px 0"/>
        <p style="margin:2px 0">📍 ${pickupArea}</p>
        <p style="margin:2px 0">🏁 ${dropoffArea}</p>
        <p style="color:#64748b;margin:2px 0">${statusLabel}${elapsed !== null ? ` · ${elapsed} dk` : ''}</p>`;
    }

    html += '</div>';
    return html;
  }, []);

  // ── Mapbox yükle ──────────────────────────────────────────────────
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
        if (!cancelled) setMapError('Harita kütüphanesi yüklenemedi.');
      }
    }
    boot();
    return () => { cancelled = true; };
  }, []);

  // ── Harita oluştur ────────────────────────────────────────────────
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
        const msg = typeof err?.message === 'string' ? err.message : 'Harita stili veya bağlantı hatası.';
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

  // ── Kurye marker güncelle ─────────────────────────────────────────
  const updateCourierMarker = useCallback((loc: CourierLocation) => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) return;

    const meta = courierMetaRef.current.get(loc.courierId);
    const vehicleType = loc.vehicleType || meta?.vehicleType || 'motorcycle';
    const status = loc.status || meta?.status || 'online';
    const fullName = loc.fullName || meta?.fullName || 'Kurye';
    const color = getOrAssignColor(loc.courierId);
    const emoji = VEHICLE_EMOJI[vehicleType] ?? '🏍️';
    const isOffline = status === 'offline';
    const borderColor = isOffline ? '#64748b' : color;

    if (markersRef.current.has(loc.courierId)) {
      const marker = markersRef.current.get(loc.courierId)!;
      marker.setLngLat([loc.lng, loc.lat]);
      // Görseli güncelle
      const el = marker.getElement();
      el.style.borderColor = borderColor;
      el.style.opacity = isOffline ? '0.45' : '1';
      el.style.boxShadow = isOffline ? 'none' : `0 0 10px ${color}60`;
    } else {
      const markerEl = document.createElement('div');
      markerEl.style.cssText = [
        'width:40px', 'height:40px', 'background:#0f2340',
        `border:2.5px solid ${borderColor}`, 'border-radius:50%',
        'display:flex', 'align-items:center', 'justify-content:center',
        'font-size:20px',
        isOffline ? 'opacity:0.45' : `box-shadow:0 0 10px ${color}60`,
        'cursor:pointer', 'transition:border-color 0.3s,opacity 0.3s,box-shadow 0.3s',
      ].join(';');
      markerEl.innerHTML = emoji;

      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
        .setHTML(buildPopupHtml(loc.courierId, vehicleType));

      const marker = new mapboxgl.Marker({ element: markerEl })
        .setLngLat([loc.lng, loc.lat])
        .setPopup(popup)
        .addTo(map);

      markerEl.addEventListener('mouseenter', () => {
        popup.setHTML(buildPopupHtml(loc.courierId, vehicleType));
        marker.togglePopup();
      });
      markerEl.addEventListener('mouseleave', () => marker.togglePopup());

      markersRef.current.set(loc.courierId, marker);
    }

    setCourierList((prev) => {
      const exists = prev.find((c) => c.id === loc.courierId);
      if (exists) {
        return prev.map((c) =>
          c.id === loc.courierId ? { ...c, status, vehicleType, color } : c
        );
      }
      return [...prev, {
        id: loc.courierId,
        name: fullName,
        status,
        vehicleType,
        color,
        statusChangedAt: new Date().toISOString(),
      }];
    });

    setCourierCount(markersRef.current.size);
    setLastUpdate(new Date());
  }, [getOrAssignColor, buildPopupHtml]);

  // Marker görselini sadece güncelle (konum değişmeden)
  const updateMarkerVisual = useCallback((courierId: string, status: string) => {
    const marker = markersRef.current.get(courierId);
    if (!marker) return;
    const el = marker.getElement();
    const isOffline = status === 'offline';
    const color = isOffline ? '#64748b' : getOrAssignColor(courierId);
    el.style.borderColor = color;
    el.style.opacity = isOffline ? '0.45' : '1';
    el.style.boxShadow = isOffline ? 'none' : `0 0 10px ${color}60`;
  }, [getOrAssignColor]);

  // ── DB'den tüm kurye meta verisi çek (offline dahil) ──────────────
  const fetchCourierMeta = useCallback(async () => {
    const supabase = createClient();

    // Tüm kuryeler – son bilinen konumu olanlar dahil
    const { data: couriers, error } = await supabase
      .from('couriers')
      .select('id, vehicle_type, status, break_reason, last_seen, current_lat, current_lng');
    if (error || !couriers) return null;

    const ids = couriers.map((c) => c.id);

    const [profilesResult, ordersResult] = await Promise.all([
      ids.length
        ? supabase.from('profiles').select('id, full_name').in('id', ids)
        : { data: [] as { id: string; full_name: string }[] },
      ids.length
        ? supabase.from('orders')
            .select('courier_id, pickup_address, dropoff_address, updated_at, status')
            .in('courier_id', ids)
            .in('status', ['assigned', 'pickup', 'in_transit'])
        : { data: [] as { courier_id: string; pickup_address: string; dropoff_address: string; updated_at: string; status: string }[] },
    ]);

    const nameMap = new Map((profilesResult.data || []).map((p) => [p.id, p.full_name]));
    const orderMap = new Map((ordersResult.data || []).map((o) => [o.courier_id, o as ActiveOrder & { courier_id: string }]));

    couriers.forEach((c) => {
      const order = orderMap.get(c.id);
      courierMetaRef.current.set(c.id, {
        vehicleType: c.vehicle_type,
        status: c.status,
        fullName: nameMap.get(c.id) ?? 'Kurye',
        break_reason: c.break_reason ?? undefined,
        break_started_at: c.status === 'break' ? c.last_seen : undefined,
        current_lat: c.current_lat,
        current_lng: c.current_lng,
        activeOrder: order ? {
          pickup_address: order.pickup_address,
          dropoff_address: order.dropoff_address,
          updated_at: order.updated_at,
          status: order.status,
        } : undefined,
      });
    });

    return couriers;
  }, []);

  // ── Socket bağlantısı ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const supabase = createClient();

    const connectSocket = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const couriers = await fetchCourierMeta();

      const socketUrl = typeof window !== 'undefined'
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_SOCKET_URL || '');

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
        const inSnapshot = new Set<string>();

        // Socket'ten gelen anlık konumlar
        Object.entries(snapshot).forEach(([courierId, loc]) => {
          if (loc?.lat && loc?.lng) {
            inSnapshot.add(courierId);
            updateCourierMarker({
              courierId, lat: loc.lat, lng: loc.lng,
              heading: loc.heading, status: loc.status,
            });
          }
        });

        // DB'deki ama socket snapshot'ında olmayan kuryeler → son bilinen konumda göster
        if (couriers) {
          couriers.forEach((c) => {
            if (!inSnapshot.has(c.id) && c.current_lat && c.current_lng) {
              updateCourierMarker({
                courierId: c.id,
                lat: c.current_lat,
                lng: c.current_lng,
                status: c.status || 'offline',
              });
            }
          });
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.on('courier:location:update', (data: any) => {
        const { courierId, lat, lng, heading } = data;
        if (lat && lng) updateCourierMarker({ courierId, lat, lng, heading });
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.on('courier:status:update', (data: any) => {
        const { courierId, status } = data;

        // Meta güncelle
        const meta = courierMetaRef.current.get(courierId);
        if (meta) {
          meta.status = status;
          if (status === 'break') meta.break_started_at = new Date().toISOString();
          courierMetaRef.current.set(courierId, meta);
        }

        // Marker görselini güncelle – KESİNLİKLE kaldırma
        updateMarkerVisual(courierId, status);

        // Liste güncelle + süre sıfırla
        setCourierList((prev) => {
          const exists = prev.find((c) => c.id === courierId);
          if (exists) {
            return prev.map((c) =>
              c.id === courierId
                ? { ...c, status, statusChangedAt: new Date().toISOString() }
                : c
            );
          }
          return prev;
        });
      });

      const orderRefreshInterval = setInterval(async () => {
        await fetchCourierMeta();
      }, 30_000);

      return () => clearInterval(orderRefreshInterval);
    };

    let cleanup: (() => void) | undefined;
    connectSocket().then((fn) => { cleanup = fn; });

    return () => {
      cleanup?.();
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [mapReady, updateCourierMarker, updateMarkerVisual, fetchCourierMeta]);

  const loading = mapLibReady && !mapReady && !mapError;

  // Aktif (online+busy+break) kurye sayısı
  const activeCount = courierList.filter((c) => c.status !== 'offline').length;

  return (
    <div className="relative">
      <div
        ref={mapContainer}
        style={{ height: `${height}px`, width: '100%' }}
        className={mapError ? 'bg-[#0a1628]' : undefined}
      />

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
            <p className="text-slate-400 text-sm">Harita yükleniyor...</p>
          </div>
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a1628] z-10 p-4">
          <p className="text-red-400 text-sm text-center max-w-md">{mapError}</p>
        </div>
      )}

      {/* Üst sol durum çubuğu */}
      <div className="absolute top-3 left-3 bg-[#0f2340]/90 backdrop-blur-sm border border-[#1e4976]/60 rounded-lg px-3 py-2 text-xs text-slate-300 flex items-center gap-3 z-10">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span>{activeCount} aktif · {courierList.filter(c => c.status === 'offline').length} offline</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-xs ${connected ? 'text-green-400' : 'text-red-400'}`}>
            {connected ? '● Canlı' : '● Bağlanıyor...'}
          </span>
        </div>
        {lastUpdate && (
          <span className="text-slate-500">
            {lastUpdate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {/* Sol alt kurye listesi */}
      {!mini && (
        <div className="absolute bottom-6 left-3 bg-[#0f2340]/85 backdrop-blur-sm border border-[#1e4976]/60 rounded-xl p-3 text-xs text-slate-300 max-h-72 overflow-y-auto min-w-[240px] z-10">
          {/* Renk lejantı */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2 mb-2 border-b border-[#1e4976]/40">
            {Object.entries(STATUS_COLOR).map(([key, color]) => (
              <div key={key} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-slate-400">{STATUS_LABEL[key]}</span>
              </div>
            ))}
          </div>

          {/* Kurye listesi */}
          {courierList.length === 0 ? (
            <p className="text-slate-500 text-center py-2">Henüz kurye yok</p>
          ) : (
            <div className="space-y-1.5">
              {/* Aktif kuryeler önce */}
              {[...courierList]
                .sort((a, b) => {
                  const order: Record<string, number> = { online: 0, busy: 1, break: 2, offline: 3 };
                  return (order[a.status] ?? 4) - (order[b.status] ?? 4);
                })
                .map((courier) => {
                  const mins = tick >= 0
                    ? Math.floor((Date.now() - new Date(courier.statusChangedAt).getTime()) / 60000)
                    : 0;
                  return (
                    <div
                      key={courier.id}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1 ${courier.status === 'offline' ? 'opacity-50' : ''}`}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: STATUS_COLOR[courier.status] ?? '#64748b' }}
                      />
                      <span className="text-sm flex-shrink-0">{VEHICLE_EMOJI[courier.vehicleType] ?? '🏍️'}</span>
                      <span className="flex-1 min-w-0 truncate text-slate-200 text-xs">{courier.name}</span>
                      <span className={`flex-shrink-0 font-medium text-xs ${STATUS_TEXT_CLASS[courier.status] ?? 'text-slate-400'}`}>
                        {STATUS_LABEL[courier.status] ?? courier.status}
                      </span>
                      <span className="flex-shrink-0 text-slate-600 text-[10px] tabular-nums">
                        {mins}dk
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
