-- Jalankan di Supabase Dashboard: SQL Editor (atau `supabase db push`)
-- Tabel setelan aplikasi (key-value). Dipakai Developer Panel untuk ganti Access PIN.

create table if not exists public.app_settings (
  key text not null primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Izinkan anon key membaca & menulis (pola sama dengan tabel lain di project ini).
create policy "app_settings_select" on public.app_settings
  for select using (true);

create policy "app_settings_insert" on public.app_settings
  for insert with check (true);

create policy "app_settings_update" on public.app_settings
  for update using (true);

-- Seed PIN awal (bisa diganti dari Developer Panel). Ganti nilai jika perlu.
insert into public.app_settings (key, value)
values ('pin', '515753')
on conflict (key) do nothing;
