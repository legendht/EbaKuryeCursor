import type { PricingConfig, VehicleType } from '@/types/database';

export function getVehicleForWeight(weight: number, configs: PricingConfig[]): PricingConfig | null {
  return (
    configs.find(
      (c) => c.is_active && weight >= c.min_weight_kg && weight <= c.max_weight_kg
    ) || null
  );
}

export function calculatePrice(distanceKm: number, config: PricingConfig): number {
  return config.base_fare + distanceKm * config.per_km_rate;
}

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  motorcycle: 'Motosiklet',
  car: 'Otomobil',
  van: 'Kamyonet',
};

export const VEHICLE_ICONS: Record<VehicleType, string> = {
  motorcycle: '🏍️',
  car: '🚗',
  van: '🚐',
};

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
  }).format(price);
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Beklemede',
  confirmed: 'Onaylandı',
  assigning: 'Kurye Aranıyor',
  assigned: 'Kurye Atandı',
  pickup: 'Paket Alındı',
  in_transit: 'Yolda',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal Edildi',
  failed: 'Başarısız',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  assigning: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  assigned: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  pickup: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  in_transit: 'bg-orange-600/20 text-orange-300 border-orange-600/30',
  delivered: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  failed: 'bg-red-700/20 text-red-500 border-red-700/30',
};
