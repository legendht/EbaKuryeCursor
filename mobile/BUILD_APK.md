# EBA Kurye — Android APK Build Rehberi

## 1. Ön Koşullar
```bash
npm install -g eas-cli
eas login          # Expo hesabınızla giriş yapın
```

## 2. eas.json içindeki IP adresleri güncelle
`eas.json` dosyasında `SUNUCU_IP` yazan yerleri VPS sunucunuzun gerçek IP adresiyle değiştirin:
```
"EXPO_PUBLIC_SOCKET_URL": "http://123.456.789.10:3001"
"EXPO_PUBLIC_APP_URL":    "http://123.456.789.10:3000"
```

## 3. APK Oluştur (Expo bulut build — bilgisayara Android SDK gerekmez)
```bash
cd mobile
eas build --platform android --profile preview
```
Build tamamlandığında Expo size indirme linki verir (~10–15 dakika).

## 4. APK'yı Telefona Yükle
- İndirilen `.apk` dosyasını kuryenin telefonuna gönderin (WhatsApp, e-posta vb.)
- Android ayarlarında "Bilinmeyen kaynaklara izin ver" aktif edin
- APK'yı açıp yükleyin

## 5. Yerel Test (Android cihaz veya emülatör bağlıysa)
```bash
npx expo start --android
```

## Notlar
- Socket sunucusu VPS'te çalışıyor olmalı (`node socket-server/index.js`)
- Next.js web uygulaması VPS'te çalışıyor olmalı
- Kurye hesabı admin panelden oluşturulup onaylanmış olmalı
