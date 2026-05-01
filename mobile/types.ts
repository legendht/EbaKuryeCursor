export type VehicleType = 'motorcycle' | 'car' | 'van';
export type OrderStatus =
  | 'pending' | 'confirmed' | 'assigning' | 'assigned'
  | 'pickup' | 'in_transit' | 'delivered' | 'cancelled' | 'failed';

export interface Order {
  id: string;
  tracking_code: string;
  customer_id: string;
  courier_id: string | null;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_contact: string | null;
  pickup_phone: string | null;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_contact: string | null;
  dropoff_phone: string | null;
  weight_kg: number;
  description: string | null;
  vehicle_type: VehicleType;
  distance_km: number | null;
  total_price: number;
  status: OrderStatus;
  base_fare: number | null;
  per_km_rate: number | null;
  rejection_reason: string | null;
  created_at: string;
}
