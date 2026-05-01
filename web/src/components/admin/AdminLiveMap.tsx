'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MAPBOX_TOKEN, ISTANBUL_CENTER } from '@/lib/mapbox';

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
  const [mapLoaded, setMapLoaded] = useState(false);
  const [courierCount, setCourierCount] = useState(0);
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

    const emoji = VEHICLE_EMOJI[loc.vehicleType || 'motorcycle'] ?? '🏍️';
    const borderColor = STATUS_COLOR[loc.status || 'online'] ?? '#22c55e';

    if (markersRef.current.has(loc.courierId)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const marker = markersRef.current.get(loc.courierId) as any;
      marker.setLngLat([loc.lng, loc.lat]);
      // Update border color
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
        .setHTML(`<div style="color:#0a1628;font-size:12px;font-weight:600">${loc.fullName || 'Kurye'}<br/>${loc.status || 'online'}</div>`);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([loc.lng, loc.lat])
        .setPopup(popup)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .addTo(map as any);

      el.addEventListener('mouseenter', () => marker.togglePopup());
      el.addEventListener('mouseleave', () => marker.togglePopup());

      markersRef.current.set(loc.courierId, marker);
    }
  }, []);

  // Remove offline couriers from map
  const removeOfflineCouriers = useCallback((onlineIds: Set<string>) => {
    markersRef.current.forEach((marker, id) => {
      if (!onlineIds.has(id)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (marker as any).remove();
        markersRef.current.delete(id);
      }
    });
    setCourierCount(markersRef.current.size);
  }, []);

  // Polling: fetch courier locations from Supabase every 3 seconds
  const fetchCouriers = useCallback(async () => {
    if (!mapRef.current) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('couriers')
      .select('id, current_lat, current_lng, vehicle_type, status, profile:profiles(full_name)')
      .in('status', ['online', 'busy', 'break'])
      .not('current_lat', 'is', null)
      .not('current_lng', 'is', null);

    if (!data) return;

    const onlineIds = new Set<string>();
    data.forEach((c) => {
      onlineIds.add(c.id);
      updateCourierMarker({
        courierId: c.id,
        lat: c.current_lat as number,
        lng: c.current_lng as number,
        vehicleType: c.vehicle_type,
        status: c.status,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fullName: (c.profile as any)?.full_name ?? 'Kurye',
      });
    });

    removeOfflineCouriers(onlineIds);
    setLastUpdate(new Date());
  }, [updateCourierMarker, removeOfflineCouriers]);

  // Start polling after map loads
  useEffect(() => {
    if (!mapLoaded) return;
    fetchCouriers();
    const interval = setInterval(fetchCouriers, 3000);
    return () => clearInterval(interval);
  }, [mapLoaded, fetchCouriers]);

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
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>{courierCount} aktif kurye</span>
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
