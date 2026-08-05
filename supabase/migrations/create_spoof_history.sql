-- Jalankan di Supabase Dashboard: SQL Editor
-- Riwayat Asset Spoofer. Id di-generate di frontend (unik per item antrian batch).
create table if not exists public.spoof_history (
  id text not null primary key,
  original_asset_id text not null,
  new_asset_id text,
  asset_type text not null check (asset_type in ('Animation', 'Audio')),
  title text not null,
  status text not null default 'Pending' check (status in ('Active', 'Pending', 'Failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

alter table public.spoof_history enable row level security;

-- Izinkan anon key membaca & menulis (pola sama dengan saved_accounts / audio_uploads)
create policy "spoof_history_select" on public.spoof_history
  for select using (true);

create policy "spoof_history_insert" on public.spoof_history
  for insert with check (true);

create policy "spoof_history_update" on public.spoof_history
  for update using (true);

create policy "spoof_history_delete" on public.spoof_history
  for delete using (true);