# Roblox Audio Uploader

Web app untuk upload audio ke Roblox menggunakan Open Cloud API.

## Cara Setup

1. Install dependencies:
```bash
npm install
```

2. Buat file `.env.local` (opsional, bisa juga langsung input di web):
```
ROBLOX_API_KEYS=your-api-key-here
ROBLOX_USER_ID=your-user-id
ROBLOX_GROUP_ID=your-group-id
```

3. Jalankan development server:
```bash
npm run dev
```

4. Buka browser: http://localhost:3000

## Cara Deploy ke Vercel

1. Push code ke GitHub
2. Login ke https://vercel.com
3. Klik "New Project"
4. Import repository GitHub kamu
5. Deploy (tidak perlu setting environment variables karena user input langsung di web)

## Cara Pakai

1. Buka website
2. Pilih target: USER atau GROUP
3. Masukkan User ID / Group ID
4. Masukkan API Key Roblox
5. Drag & drop file audio atau klik "Pilih File"
6. Klik "Upload Semua"
7. Tunggu proses selesai
8. Klik "Copy Hasil" untuk copy Asset ID

## Cara Dapat API Key

1. Buka: https://create.roblox.com/credentials
2. Klik "CREATE API KEY"
3. Pilih API System: "Assets API"
4. Tambahkan permission: "Asset:Read" dan "Asset:Write"
5. Pilih "Use all IP Addresses"
6. Save & copy API Key

## Catatan

- Format audio: MP3, OGG, FLAC, WAV
- Max durasi: 7 menit
- Max ukuran: 20 MB
- Akun harus ID Verified
- Limit: 100 audio per bulan
