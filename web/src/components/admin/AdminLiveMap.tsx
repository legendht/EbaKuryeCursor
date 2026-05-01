'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<Map<string, unknown>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const courierMetaRef = useRef<Map<string, { vehicleType: string; fullName: string; status: string }>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);
  const [courierCount, setCourierCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Load Mapbox GL JS
  useEffect(() => {
    if ((window as Window & { mapboxgl?: unknown }).mapboxgl) { setMapLoaded(true); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !mapContainer.current || mapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapboxgl = (window as any).mapboxgl;
    if (!mapboxgl) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: ISTANBUL_CENTER,
      zoom: mini ? 10 : 11,
    });
    mapRef.current = map;

    if (!mini) {
      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
    }

    return () => { map.remove(); mapRef.current = null; };
  }, [mapLoaded, mini]);

  const updateCourierMarker = useCallback((loc: CourierLocation) => {
    const map = mapRef.current;
    if (!map) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapboxgl = (window as any).mapboxgl;
    if (!mapboxgl) return;

    const meta = courierMetaRef.current.get(loc.courierId);
    const vehicleType = loc.vehicleType || meta?.vehicleType || 'motorcycle';
    const status = loc.status || meta?.status || 'online';
    const fullName = loc.fullName || meta?.fullName || 'Kurye';

    const emoji = VEHICLE_EMOJI[vehicleType] ?? '🏍️';
    const borderColor = STATUS_COLOR[status] ?? '#22c55e';

    if (markersRef.current.has(loc.courierId)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const marker = markersRef.current.get(loc.courierId) as any;
      marker.setLngLat([loc.lng, loc.lat]);
      const el = marker.getElement();
      if (el) el.style.borderColor = borderColor;
    } else {
      const el = document.createElement('div');
      el.style.cssText = [
        'width:40px', 'height:40px', 'background:#0f2340',
        `border:2.5px solid ${borderColor}`, 'border-radius:50%',
        'display:flex', 'align-items:center', 'justify-content:center',
        'font-size:20px', `box-shadow:0 0 10px ${borderColor}60`,
        'cursor:pointer', 'transition:border-color 0.3s',
      ].join(';');
      el.innerHTML = emoji;

      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
        .setHTML(`<div style="color:#0a1628;font-size:12px;font-weight:600">${fullName}<br/>${status}</div>`);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([loc.lng, loc.lat])
        .setPopup(popup)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .addTo(map as any);

      el.addEventListener('mouseenter', () => marker.togglePopup());
      el.addEventListener('mouseleave', () => marker.togglePopup());

      markersRef.current.set(loc.courierId, marker);
    }
    setCourierCount(markersRef.current.size);
    setLastUpdate(new Date());
  }, []);

  // Fetch courier metadata (vehicle type, name, status) from DB
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

  // Remove markers for offline couriers
  const removeMarker = useCallback((courierId: string) => {
    if (markersRef.current.has(courierId)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (markersRef.current.get(courierId) as any).remove();
      markersRef.current.delete(courierId);
      setCourierCount(markersRef.current.size);
    }
  }, []);

  // Connect to Socket.io and join admin tracking room
  useEffect(() => {
    if (!mapLoaded) return;

    const supabase = createClient();

    const connectSocket = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch courier metadata first
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

      // Snapshot of all current courier locations on join
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.on('admin:tracking:snapshot', (snapshot: Record<string, any>) => {
        Object.entries(snapshot).forEach(([courierId, loc]) => {
          if (loc?.lat && loc?.lng) {
            updateCourierMarker({ courierId, lat: loc.lat, lng: loc.lng, heading: loc.heading });
          }
        });
      });

      // Real-time location updates from couriers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.on('courier:location:update', (data: any) => {
        const { courierId, lat, lng, heading } = data;
        if (lat && lng) {
          updateCourierMarker({ courierId, lat, lng, heading });
        }
      });

      // Courier status change
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
        } else {
          // Update marker color
          if (markersRef.current.has(courierId)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const marker = markersRef.current.get(courierId) as any;
            const el = marker.getElement();
            if (el) el.style.borderColor = STATUS_COLOR[status] ?? '#64748b';
          }
        }
      });
    };

    connectSocket();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [mapLoaded, updateCourierMarker, removeMarker, fetchCourierMeta]);

  return (
    <div className="relative">
      <div ref={mapContainer} style={{ height: `${height}px`, width: '100%' }} />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a1628]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Harita yükleniyor...</p>
          </div>
        </div>
      )}
      {/* Stats overlay */}
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
      {/* Legend */}
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
