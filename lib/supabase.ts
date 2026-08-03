import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type AudioUpload = {
  id: string;
  asset_id: string;
  name: string;
  status: 'Active' | 'Pending' | 'Failed' | 'Copyright';
  original_speed: number;
  amplify: number;
  roblox_playback_speed: number;
  youtube_url?: string;
  uploaded_at: string;
  updated_at: string;
};
