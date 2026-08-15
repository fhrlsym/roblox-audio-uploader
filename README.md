# Roblox Audio Uploader

YouTube to Roblox Audio Converter & Batch Uploader with shared database tracking.

## Features

- ✅ YouTube URL → MP3 converter
- ✅ Audio tuning: Speed & Amplify (dB)
- ✅ Auto-calculate Roblox playback speed
- ✅ Batch upload multiple files
- ✅ Multiple API keys support
- ✅ Upload history with status tracking (Active, Pending, Failed, Copyright)
- ✅ Shared database (Supabase) for team collaboration
- ✅ PIN-protected access (515753)

## Setup Instructions

### 1. Setup Supabase Database

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project (free tier available)
3. Go to SQL Editor and run this query:

```sql
CREATE TABLE audio_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Active', 'Pending', 'Failed', 'Copyright')),
  original_speed NUMERIC NOT NULL,
  amplify INTEGER NOT NULL,
  roblox_playback_speed NUMERIC NOT NULL,
  youtube_url TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audio_uploads_uploaded_at ON audio_uploads(uploaded_at DESC);
CREATE INDEX idx_audio_uploads_status ON audio_uploads(status);
```

4. Go to Settings → API
5. Copy your:
   - Project URL
   - Anon/Public key

6. Update `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Install Dependencies

```bash
npm install
cd backend
npm install
```

### 3. Install FFmpeg (Required for audio processing)

**Windows:**
- Download from: https://www.gyan.dev/ffmpeg/builds/
- Extract and add to PATH

**Mac:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
```

### 4. Run the Application

Terminal 1 (Frontend):
```bash
npm run dev
```

Terminal 2 (Backend):
```bash
cd backend
npm start
```

Open: [http://localhost:3000](http://localhost:3000)

## Deployment

### Deploy Frontend to Vercel

1. Push code to GitHub
2. Go to [https://vercel.com](https://vercel.com)
3. Import repository
4. Add environment variables:
   - `NEXT_PUBLIC_BACKEND_URL` (your backend URL)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy

### Deploy Backend to Railway/Render

**Railway:**
1. Go to [https://railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Select `backend` folder
4. Set start command: `npm start`
5. Add PORT environment variable (auto-provided)
6. Deploy. The Docker image includes a local BgUtils PO Token provider for YouTube.
7. SoundCloud track URLs work without cookies.

**Render:**
1. Go to [https://render.com](https://render.com)
2. New Web Service
3. Connect repository
4. Root Directory: `backend`
5. Start Command: `npm start`
6. Deploy

## Usage

1. Enter PIN: `515753`
2. Configure audio settings:
   - Speed: 2.30x (default)
   - Amplify: -4dB (default)
3. Add YouTube URLs (one per line)
4. Click "Download & Convert to MP3"
5. Enter Roblox User/Group ID
6. Add API keys from [https://create.roblox.com/credentials](https://create.roblox.com/credentials)
7. Click "Upload to Roblox"
8. View upload history and status

## Notes

- Default settings (2.30x speed, -4dB) → Roblox playback: 0.4348
- Upload history is shared across all users with PIN access
- Status auto-refreshes every 30 seconds
- Backend processes YouTube downloads server-side

## License

MIT
