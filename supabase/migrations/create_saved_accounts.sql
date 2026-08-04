-- Jalankan di Supabase Dashboard: SQL Editor
-- 1) Tabel akun Roblox tersimpan (shared: metadata akun saja)
--    NOTE: api_key TIDAK disimpan di sini (keamanan). API key hanya ada di localStorage pengguna.
--    Jika tabel lama masih punya kolom api_key, hapus dengan: alter table public.saved_accounts drop column if exists api_key;

create table if not exists public.saved_accounts (
  id text not null,
  type text not null check (type in ('user', 'group')),
  name text not null,
  display_name text,
  member_count bigint,
  has_verified_badge boolean default false,
  thumbnail text,
  owner_id text,
  owner_name text,
  audio_usage bigint,
  audio_capacity bigint,
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

-- 2) Kolom pemilik & kuota audio (cache; kuota di-refresh otomatis dari Roblox tiap load/interval)
alter table public.saved_accounts add column if not exists owner_id text;
alter table public.saved_accounts add column if not exists owner_name text;
alter table public.saved_accounts add column if not exists audio_usage bigint;
alter table public.saved_accounts add column if not exists audio_capacity bigint;

-- 3) Riwayat upload: simpan akun mana yang dipakai saat upload (untuk cek status pakai API key yang benar)
-- alter table public.audio_uploads add column if not exists account_id text;
