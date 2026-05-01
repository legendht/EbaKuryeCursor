-- =====================================================
-- EBA KURYE - Initial Database Schema
-- =====================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE vehicle_type AS ENUM ('motorcycle', 'car', 'van');
CREATE TYPE order_status AS ENUM (
  'pending',       -- Oluşturuldu, ödeme bekleniyor
  'confirmed',     -- Müşteri fiyatı onayladı
  'assigning',     -- Kurye atanıyor
  'assigned',      -- Kurye kabul etti, yola çıkıyor
  'pickup',        -- Kurye alım noktasında
  'in_transit',    -- Taşıma devam ediyor
  'delivered',     -- Teslim edildi
  'cancelled',     -- İptal edildi
  'failed'         -- Başarısız
);
CREATE TYPE user_role AS ENUM ('admin', 'courier', 'customer');
CREATE TYPE courier_status AS ENUM ('online', 'busy', 'offline');

-- =====================================================
-- PROFILES (extends auth.users)
-- =====================================================
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  phone         TEXT,
  role          user_role NOT NULL DEFAULT 'customer',
  avatar_url    TEXT,
  company_name  TEXT,  -- B2B
  tax_number    TEXT,  -- B2B vergi no
  is_b2b        BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- =====================================================
-- PRICING CONFIG
-- =====================================================
CREATE TABLE pricing_config (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_type  vehicle_type NOT NULL UNIQUE,
  base_fare     NUMERIC(10,2) NOT NULL DEFAULT 0,   -- Açılış ücreti
  per_km_rate   NUMERIC(10,2) NOT NULL DEFAULT 0,   -- KM başı ücret
  min_weight_kg NUMERIC(8,2)  NOT NULL DEFAULT 0,   -- Min ağırlık eşiği
  max_weight_kg NUMERIC(8,2)  NOT NULL DEFAULT 999, -- Max ağırlık eşiği
  is_active     BOOLEAN DEFAULT TRUE,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read pricing" ON pricing_config FOR SELECT USING (TRUE);
CREATE POLICY "Admins can manage pricing"
  ON pricing_config FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Default pricing
INSERT INTO pricing_config (vehicle_type, base_fare, per_km_rate, min_weight_kg, max_weight_kg) VALUES
  ('motorcycle', 30.00, 5.00,  0,    10),
  ('car',        50.00, 8.00,  10,   75),
  ('van',        80.00, 12.00, 75, 1000);

-- =====================================================
-- SITE SETTINGS (WhatsApp no vb.)
-- =====================================================
CREATE TABLE site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  label TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read settings" ON site_settings FOR SELECT USING (TRUE);
CREATE POLICY "Admins can manage settings"
  ON site_settings FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

INSERT INTO site_settings (key, value, label) VALUES
  ('whatsapp_number', '905XXXXXXXXX', 'WhatsApp İletişim Numarası'),
  ('company_name',    'EBA Kurye', 'Şirket Adı'),
  ('company_address', 'İstanbul, Türkiye', 'Şirket Adresi'),
  ('working_hours',   '07:00 - 23:00', 'Çalışma Saatleri');

-- =====================================================
-- COURIERS
-- =====================================================
CREATE TABLE couriers (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_type  vehicle_type NOT NULL,
  vehicle_plate TEXT,
  vehicle_model TEXT,
  status        courier_status DEFAULT 'offline',
  current_lat   DOUBLE PRECISION,
  current_lng   DOUBLE PRECISION,
  last_seen     TIMESTAMPTZ,
  rating        NUMERIC(3,2) DEFAULT 5.00,
  total_orders  INTEGER DEFAULT 0,
  is_approved   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Couriers can view own data"
  ON couriers FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Couriers can update own status"
  ON couriers FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can manage couriers"
  ON couriers FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- =====================================================
-- ORDERS
-- =====================================================
CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_code    TEXT UNIQUE NOT NULL,
  customer_id      UUID NOT NULL REFERENCES auth.users(id),
  courier_id       UUID REFERENCES couriers(id),

  -- Pickup
  pickup_address   TEXT NOT NULL,
  pickup_lat       DOUBLE PRECISION NOT NULL,
  pickup_lng       DOUBLE PRECISION NOT NULL,
  pickup_contact   TEXT,
  pickup_phone     TEXT,

  -- Dropoff
  dropoff_address  TEXT NOT NULL,
  dropoff_lat      DOUBLE PRECISION NOT NULL,
  dropoff_lng      DOUBLE PRECISION NOT NULL,
  dropoff_contact  TEXT,
  dropoff_phone    TEXT,

  -- Cargo
  weight_kg        NUMERIC(8,2) NOT NULL DEFAULT 1,
  description      TEXT,
  cargo_photo_url  TEXT,

  -- Pricing
  vehicle_type     vehicle_type NOT NULL,
  distance_km      NUMERIC(8,2),
  base_fare        NUMERIC(10,2),
  per_km_rate      NUMERIC(10,2),
  total_price      NUMERIC(10,2) NOT NULL,

  -- Status
  status           order_status DEFAULT 'pending',

  -- Proof of delivery
  pickup_photo_url     TEXT,
  pickup_signature_url TEXT,
  delivery_photo_url   TEXT,
  delivery_signature_url TEXT,
  delivered_at         TIMESTAMPTZ,

  -- Notes
  notes            TEXT,
  admin_notes      TEXT,

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own orders"
  ON orders FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Customers can create orders"
  ON orders FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Couriers can view assigned orders"
  ON orders FOR SELECT
  USING (auth.uid() = courier_id);

CREATE POLICY "Couriers can update assigned orders"
  ON orders FOR UPDATE
  USING (auth.uid() = courier_id);

CREATE POLICY "Admins can manage all orders"
  ON orders FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Public tracking (tracking code ile herkes görebilir - sadece belirli alanlar)
CREATE POLICY "Anyone can track by tracking code"
  ON orders FOR SELECT USING (TRUE);

-- Tracking code generator
CREATE OR REPLACE FUNCTION generate_tracking_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT := 'EBA-';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Auto-generate tracking code
CREATE OR REPLACE FUNCTION set_tracking_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tracking_code IS NULL OR NEW.tracking_code = '' THEN
    LOOP
      NEW.tracking_code := generate_tracking_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE tracking_code = NEW.tracking_code);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_tracking_code
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION set_tracking_code();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- ORDER STATUS HISTORY
-- =====================================================
CREATE TABLE order_status_history (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     order_status NOT NULL,
  note       TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order status visible to participants"
  ON order_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_id
        AND (o.customer_id = auth.uid() OR o.courier_id = auth.uid())
    )
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Auto-log status changes
CREATE OR REPLACE FUNCTION log_order_status()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (order_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_order_status
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status();

-- =====================================================
-- CURRENT ACCOUNT (Cari Hesap)
-- =====================================================
CREATE TABLE customer_accounts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance     NUMERIC(12,2) NOT NULL DEFAULT 0,  -- Pozitif = Alacak, Negatif = Borç
  credit_limit NUMERIC(12,2) DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customer_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can view own account"
  ON customer_accounts FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Admins can manage accounts"
  ON customer_accounts FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE TABLE account_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  order_id    UUID REFERENCES orders(id),
  type        TEXT NOT NULL CHECK (type IN ('debit', 'credit', 'payment', 'refund')),
  amount      NUMERIC(12,2) NOT NULL,
  description TEXT,
  balance_after NUMERIC(12,2),
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can view own transactions"
  ON account_transactions FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Admins can manage transactions"
  ON account_transactions FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT DEFAULT 'info',
  order_id    UUID REFERENCES orders(id),
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_orders_customer_id     ON orders(customer_id);
CREATE INDEX idx_orders_courier_id      ON orders(courier_id);
CREATE INDEX idx_orders_status          ON orders(status);
CREATE INDEX idx_orders_tracking_code   ON orders(tracking_code);
CREATE INDEX idx_orders_created_at      ON orders(created_at DESC);
CREATE INDEX idx_couriers_status        ON couriers(status);
CREATE INDEX idx_notifications_user_id  ON notifications(user_id, is_read);

-- =====================================================
-- VIEWS (with security_invoker)
-- =====================================================
CREATE VIEW public_order_tracking WITH (security_invoker = true) AS
SELECT
  o.tracking_code,
  o.status,
  o.pickup_address,
  o.dropoff_address,
  o.vehicle_type,
  o.created_at,
  o.delivered_at,
  c.current_lat  AS courier_lat,
  c.current_lng  AS courier_lng,
  c.last_seen    AS courier_last_seen,
  o.delivery_photo_url,
  o.delivery_signature_url
FROM orders o
LEFT JOIN couriers c ON c.id = o.courier_id;

-- =====================================================
-- Auto-create customer account on signup
-- =====================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_app_meta_data->>'role')::user_role, 'customer')
  );

  IF COALESCE((NEW.raw_app_meta_data->>'role'), 'customer') = 'customer' THEN
    INSERT INTO customer_accounts (customer_id) VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
