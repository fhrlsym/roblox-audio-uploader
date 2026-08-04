-- Jalankan di Supabase Dashboard: SQL Editor
-- Tabel akun Roblox tersimpan (shared: semua pengguna melihat & memakai daftar yang sama)

create table if not exists public.saved_accounts (
  id text not null,
  type text not null check (type in ('user', 'group')),
  name text not null,
  display_name text,
  member_count bigint,
  has_verified_badge boolean default false,
  thumbnail text,
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
