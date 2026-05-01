export type VehicleType = 'motorcycle' | 'car' | 'van';
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'assigning'
  | 'assigned'
  | 'pickup'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'failed';
export type UserRole = 'admin' | 'courier' | 'customer';
export type CourierStatus = 'online' | 'busy' | 'offline';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  company_name: string | null;
  tax_number: string | null;
  is_b2b: boolean;
  created_at: string;
  updated_at: string;
}

export interface PricingConfig {
  id: string;
  vehicle_type: VehicleType;
  base_fare: number;
  per_km_rate: number;
  min_weight_kg: number;
  max_weight_kg: number;
  is_active: boolean;
  updated_at: string;
}

export interface Courier {
  id: string;
  vehicle_type: VehicleType;
  vehicle_plate: string | null;
  vehicle_model: string | null;
  status: CourierStatus;
  current_lat: number | null;
  current_lng: number | null;
  last_seen: string | null;
  rating: number;
  total_orders: number;
  is_approved: boolean;
  created_at: string;
  profile?: Profile;
}

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
  cargo_photo_url: string | null;
  vehicle_type: VehicleType;
  distance_km: number | null;
  base_fare: number | null;
  per_km_rate: number | null;
  total_price: number;
  status: OrderStatus;
  pickup_photo_url: string | null;
  pickup_signature_url: string | null;
  delivery_photo_url: string | null;
  delivery_signature_url: string | null;
  delivered_at: string | null;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: Profile;
  courier?: Courier;
}

export interface CustomerAccount {
  id: string;
  customer_id: string;
  balance: number;
  credit_limit: number;
  updated_at: string;
}

export interface AccountTransaction {
  id: string;
  customer_id: string;
  order_id: string | null;
  type: 'debit' | 'credit' | 'payment' | 'refund';
  amount: number;
  description: string | null;
  balance_after: number | null;
  created_at: string;
}

export interface SiteSetting {
  key: string;
  value: string;
  label: string | null;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  order_id: string | null;
  is_read: boolean;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
