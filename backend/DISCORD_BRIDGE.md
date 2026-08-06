# Discord Bridge Bot — Setup

Fitur ini menghubungkan website Anda ke bot Discord **Sound Downloader** (Harmless) sehingga Anda bisa memasukkan Asset ID di web, lalu file hasilnya diteruskan kembali ke web untuk diunduh.

## Cara kerja

```
[Web] → masukkan Asset ID → backend buat permintaan
   ↓ (web tampilkan perintah /download + tombol salin)
[User] → tempel /download asset_id:ID di channel Discord
   ↓
[Sound Downloader bot] → post file OGG/mp3 ke channel
   ↓ (bridge bot menonton channel tsb)
[Bridge bot (discord.js)] → unduh attachment → simpan ke /uploads
   ↓
[Web] → polling status → dapat file → unduh
```

## Yang perlu disiapkan

### 1. Buat Bridge Bot (Discord Developer Portal)
1. Buka https://discord.com/developers/applications
2. **New Application** → beri nama (mis. "S2 Bridge")
3. Sidebar → **Bot** → **Reset Token** → salin **Token** (inilah `DISCORD_BOT_TOKEN`)
4. Di tab Bot, nyalakan intents:
   - ✅ **Presence Intent**
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
5. Sidebar → **OAuth2 → URL Generator**:
   - Scopes: `bot`
   - Bot Permissions: **Read Messages**, **View Channels**, **Attach Files**, **Send Messages**
   - Salin URL, buka di browser, invite bot ke server yang sama dengan Sound Downloader

### 2. Ambil ID Channel
1. Di Discord, klik kanan channel tempat Sound Downloader berinteraksi → **Copy Channel ID** (inilah `DISCORD_CHANNEL_ID`)
2. (Opsional) Klik kanan ikon Sound Downloader bot → **Copy User ID** (inilah `DISCORD_DOWNLOADER_USER_ID`, agar hanya file dari bot itu yang diproses)

### 3. Set Environment Variable di backend
Tambahkan ke env backend (file `.env` / dashboard Railway/Vercel):

```
DISCORD_BOT_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxx
DISCORD_CHANNEL_ID=123456789012345678
DISCORD_DOWNLOADER_USER_ID=987654321098765432   # opsional
```

> Bridge bot hanya akan login & menonton channel **jika** keduanya di-set. Tanpa itu, fitur tetap tampil di web tapi status bot "Offline".

## Endpoint API

| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/discord-bridge/status` | status koneksi bridge bot |
| POST | `/api/discord-bridge/submit` | buat permintaan asset id |
| GET | `/api/discord-bridge/status/:assetId` | polling status permintaan |
| GET | `/api/discord-bridge/download/:assetId` | unduh file hasil |
| DELETE | `/api/discord-bridge/:assetId` | hapus permintaan |

## Catatan penting

- **Slash command tidak bisa dipicu otomatis oleh bot lain.** Pengguna harus mengetik `/download asset_id:ID` sendiri di Discord. Website menampilkan perintah + tombol salin untuk memudahkan.
- File disimpan di `backend/uploads/` dan dibersihkan otomatis oleh `sweepOldFiles` (45 menit).
- Permintaan kadaluarsa setelah 10 menit.