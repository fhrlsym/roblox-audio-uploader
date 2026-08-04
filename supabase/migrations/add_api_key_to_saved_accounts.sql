-- Tambahkan kolom api_key di saved_accounts agar akun bisa di-share antar user (2 pemakai).
-- API key disimpan per akun di database; tiap akun punya api key sendiri.
-- Jalankan di Supabase Dashboard: SQL Editor
alter table public.saved_accounts add column if not exists api_key text;
