# EBA Kurye — VPS Deploy Rehberi (CloudPanel + Node.js)

## ⚡ Özet
Bu rehberi VPS'te terminal üzerinden adım adım uygulayın.
GitHub repo: https://github.com/legendht/EbaKuryeCursor.git

---

## 1. VPS'e SSH ile bağlanın
```bash
ssh root@SUNUCU_IP
```

---

## 2. Gerekli araçları yükleyin (ilk kurulumda bir kez)
```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# PM2 (process manager)
npm install -g pm2

# Git (zaten varsa atla)
apt-get install -y git
```

---

## 3. Projeyi klonlayın
```bash
cd /var/www
git clone https://github.com/legendht/EbaKuryeCursor.git ebakurye
cd ebakurye
```

---

## 4. Web uygulaması kurulumu
```bash
cd /var/www/ebakurye/web
npm install

# .env.local dosyasını oluşturun
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://wxlpsabcetinkxbwczvg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4bHBzYWJjZXRpbmt4YndjenZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MTE4NjYsImV4cCI6MjA5MzE4Nzg2Nn0.wASjuS9poEUptIh3wiyAFWOz_X_K07TqGSYk1My2WW4
SUPABASE_SERVICE_ROLE_KEY=BURAYA_SERVICE_ROLE_KEY_YAZIN
NEXT_PUBLIC_MAPBOX_TOKEN=BURAYA_MAPBOX_TOKEN_YAZIN
NEXT_PUBLIC_SOCKET_URL=http://SUNUCU_IP:3001
SOCKET_INTERNAL_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://SUNUCU_IP:3000
EOF

# Build al
npm run build
```

---

## 5. Socket sunucusu kurulumu
```bash
cd /var/www/ebakurye/socket-server
npm install

# .env dosyasını oluşturun
cat > .env << 'EOF'
PORT=3001
SUPABASE_URL=https://wxlpsabcetinkxbwczvg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=BURAYA_SERVICE_ROLE_KEY_YAZIN
ALLOWED_ORIGINS=http://SUNUCU_IP:3000,https://DOMAIN_ADINIZ
EOF
```

---

## 6. PM2 ile servisleri başlatın
```bash
# Web uygulaması
cd /var/www/ebakurye/web
pm2 start npm --name "ebakurye-web" -- start

# Socket sunucusu
cd /var/www/ebakurye/socket-server
pm2 start index.js --name "ebakurye-socket"

# PM2'yi sistem başlangıcına ekle
pm2 startup
pm2 save
```

---

## 7. PM2 durumunu kontrol edin
```bash
pm2 status
pm2 logs ebakurye-web --lines 20
pm2 logs ebakurye-socket --lines 20
```

---

## 8. CloudPanel'de site ayarları (domain varsa)
CloudPanel → Sites → Add Site:
- **Domain:** ebakurye.com (veya IP ile çalışıyorsanız bu adımı atlayın)
- **Node.js versiyonu:** 20
- **Root directory:** /var/www/ebakurye/web
- **Proxy Port:** 3000

---

## 9. Firewall portları açın
```bash
ufw allow 3000   # Web
ufw allow 3001   # Socket
ufw allow 80     # HTTP
ufw allow 443    # HTTPS
ufw enable
```

---

## 🔄 Sonraki güncellemelerde (tek komut)
```bash
cd /var/www/ebakurye
git pull origin main
cd web && npm install && npm run build
pm2 restart ebakurye-web
pm2 restart ebakurye-socket
```

---

## 📋 Önemli Notlar
- `BURAYA_SERVICE_ROLE_KEY_YAZIN` → Supabase Dashboard > Project Settings > API > service_role key
- `SUNUCU_IP` → VPS'inizin gerçek IP adresi (örn: 192.168.1.100)
- `DOMAIN_ADINIZ` → Alan adınız varsa (örn: ebakurye.com)
- Web uygulaması default olarak **port 3000**'de çalışır
- Socket sunucusu **port 3001**'de çalışır
