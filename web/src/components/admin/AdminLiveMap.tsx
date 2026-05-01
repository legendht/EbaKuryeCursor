'use client';

import { useEffect, useRef, useState } from 'react';
import { connectSocket } from '@/lib/socket';
import { createClient } from '@/lib/supabase/client';
import { MAPBOX_TOKEN, ISTANBUL_CENTER } from '@/lib/mapbox';

interface CourierLocation {
  courierId: string;
  lat: number;
  lng: number;
  heading?: number;
  vehicleType?: string;
}

interface AdminLiveMapProps {
  height?: number;
  mini?: boolean;
}

export default function AdminLiveMap({ height = 600, mini = false }: AdminLiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<Map<string, unknown>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);
  const [courierCount, setCourierCount] = useState(0);

  // Load mapboxgl script
  useEffect(() => {
    if (window.mapboxgl) { setMapLoaded(true); return; }
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
    const mapboxgl = window.mapboxgl;
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
    }

    return () => { map.remove(); mapRef.current = null; };
  }, [mapLoaded, mini]);

  // Load initial courier positions from DB
  useEffect(() => {
    if (!mapRef.current) return;
    const supabase = createClient();

    supabase
      .from('couriers')
      .select('id, current_lat, current_lng, vehicle_type, status')
      .in('status', ['online', 'busy'])
      .not('current_lat', 'is', null)
      .then(({ data }) => {
        if (!data) return;
        setCourierCount(data.length);
        data.forEach((c) => updateCourierMarker({ courierId: c.id, lat: c.current_lat!, lng: c.current_lng!, vehicleType: c.vehicle_type }));
      });
  }, [mapLoaded]);

  const updateCourierMarker = (loc: CourierLocation) => {
    const map = mapRef.current as { addTo?: unknown } | null;
    if (!map) return;
    const mapboxgl = window.mapboxgl;
    if (!mapboxgl) return;

    const emoji = loc.vehicleType === 'motorcycle' ? '🏍️' : loc.vehicleType === 'van' ? '🚐' : '🚗';

    if (markersRef.current.has(loc.courierId)) {
      const marker = markersRef.current.get(loc.courierId) as { setLngLat: (c: [number, number]) => void };
      marker.setLngLat([loc.lng, loc.lat]);
    } else {
      const el = document.createElement('div');
      el.className = 'cursor-pointer';
      el.style.cssText = 'width:36px;height:36px;background:#1e4976;border:2px solid #f97316;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(249,115,22,0.4);';
      el.innerHTML = emoji;
      el.title = `Kurye: ${loc.courierId.slice(0, 8)}`;

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([loc.lng, loc.lat])
        .addTo(map as Parameters<typeof mapboxgl.Marker.prototype.addTo>[0]);
      markersRef.current.set(loc.courierId, marker);
      setCourierCount(markersRef.current.size);
    }
  };

  // Socket.io live updates
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const socket = connectSocket();
      socket.emit('admin:join:tracking', { token: session.access_token });
      socket.on('admin:tracking:snapshot', (snapshot: Record<string, CourierLocation & { vehicleType?: string }>) => {
        Object.entries(snapshot).forEach(([cid, loc]) => {
          const { courierId: _unused, ...rest } = loc as CourierLocation & { vehicleType?: string };
          void _unused;
          updateCourierMarker({ courierId: cid, ...rest });
        });
      });
      socket.on('courier:location:update', (data: CourierLocation) => {
        updateCourierMarker(data);
      });
    });

    return () => {
      const socket = connectSocket();
      socket.off('admin:tracking:snapshot');
      socket.off('courier:location:update');
    };
  }, [mapLoaded]);

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
      {/* Overlay stats */}
      <div className="absolute top-3 left-3 bg-[#0f2340]/90 backdrop-blur-sm border border-[#1e4976]/60 rounded-lg px-3 py-2 text-xs text-slate-300 flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span>{courierCount} aktif kurye</span>
      </div>
    </div>
  );
}
