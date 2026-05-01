# EBA Kurye - Lojistik Platform

## Hızlı Kurulum

### 1. Supabase Projesi Oluştur
- [supabase.com](https://supabase.com) üzerinde yeni proje oluştur
- `web/supabase/migrations/001_initial.sql` dosyasını SQL Editor'da çalıştır
- Auth > Email ayarlarını yapılandır

### 2. Web Uygulaması
```bash
cd web
# .env.local dosyasını düzenle
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

npm run dev  # http://localhost:3000
```

### 3. Socket.io Sunucusu
```bash
cd socket-server
cp .env.example .env
# .env düzenle
npm start    # http://localhost:3001
```

### 4. Mobil Uygulama (Expo)
```bash
cd mobile
# .env düzenle (EXPO_PUBLIC_* değişkenleri)
npx expo start
```

## Admin Kullanıcı Oluşturma
Supabase Dashboard > SQL Editor:
```sql
UPDATE auth.users SET raw_app_meta_data = '{"role":"admin"}' WHERE email = 'admin@ebakurye.com';
```

## Kurye Kullanıcı Oluşturma
1. Normal üye ol (web)
2. SQL ile kurye kaydı ekle:
```sql
INSERT INTO couriers (id, vehicle_type, is_approved) 
VALUES ('user-uuid-here', 'motorcycle', true);
UPDATE profiles SET role = 'courier' WHERE id = 'user-uuid-here';
```

## Mimari

```
EBA Kurye/
├── web/           # Next.js 16 (App Router) - Ana web uygulaması
│   ├── src/app/   # Sayfalar
│   │   ├── (auth)/        # Login, Register
│   │   ├── (dashboard)/   # Müşteri paneli
│   │   ├── admin/         # Admin paneli
│   │   ├── track/         # Sipariş takibi
│   │   └── api/           # API route'lar
│   └── supabase/migrations/  # Veritabanı şeması
├── socket-server/ # Node.js + Socket.io - Canlı konum
└── mobile/        # React Native + Expo - Kurye uygulaması
```

## Özellikler

- ✅ Mapbox Geocoding + Directions (İstanbul sınırlı)
- ✅ Gerçek zamanlı filo haritası (Socket.io)
- ✅ Akıllı kurye atama (en yakın)
- ✅ Canlı sipariş takibi
- ✅ Cari hesap modülü
- ✅ Admin paneli (CRUD, fiyat ayarları)
- ✅ Resim sıkıştırma (client-side, max 250KB)
- ✅ WhatsApp entegrasyonu (admin panelinden dinamik)
- ✅ Background GPS (mobil)
