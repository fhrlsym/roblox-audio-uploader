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

export type SavedAccountRow = {
  id: string;
  type: 'user' | 'group';
  name: string;
  display_name?: string | null;
  member_count?: number | null;
  has_verified_badge?: boolean | null;
  thumbnail?: string | null;
  created_at?: string;
};
