-- Jalankan di Supabase Dashboard: SQL Editor
-- 1) Perbaiki tabel akun Roblox tersimpan (shared: semua pengguna melihat & memakai daftar yang sama)
--    + tambah kolom api_key (API key per akun, ikut tersimpan)

create table if not exists public.saved_accounts (
  id text not null,
  type text not null check (type in ('user', 'group')),
  name text not null,
  display_name text,
  member_count bigint,
  has_verified_badge boolean default false,
  thumbnail text,
  api_key text,
  created_at timestamptz default now(),
  primary key (id, type)
);

alter table public.saved_accounts enable row level security;

-- Izinkan anon key membaca & menulis (sesuai perilaku tabel audio_uploads)
create policy "saved_accounts_select" on public.saved_accounts
  for select using (true);

create policy "saved_accounts_insert" on public.saved_accounts
  for insert with check (true);

create policy "saved_accounts_delete" on public.saved_accounts
  for delete using (true);

-- 2) Jika tabel saved_accounts SUDAH dibuat tanpa kolom api_key, jalankan baris ini saja:
-- alter table public.saved_accounts add column if not exists api_key text;

-- 3) Riwayat upload: simpan akun mana yang dipakai saat upload (untuk cek status pakai API key yang benar)
-- alter table public.audio_uploads add column if not exists account_id text;
