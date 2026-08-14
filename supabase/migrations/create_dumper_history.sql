-- Tabel riwayat dump script (Luau Dumper).
-- Dipakai oleh useDumperHistory (hybrid: localStorage + Supabase).
-- id dibuat di client (uuid acak), created_at berupa timestamp ISO.

create table if not exists public.dumper_history (
    id text primary key,
    title text,
    obfuscator text,
    engine text,
    original_lines integer default 0,
    dumped_lines integer default 0,
    constants_count integer default 0,
    http_logs_count integer default 0,
    execution_time_ms integer default 0,
    input_snippet text,
    input_code text,
    dumped_code text,
    http_logs jsonb default '[]'::jsonb,
    constants jsonb default '[]'::jsonb,
    created_at timestamptz default now()
);

alter table public.dumper_history enable row level security;

-- Web ini pribadi; siapapun yang punya anon key boleh baca/tulis riwayatnya.
create policy "dumper_history_all" on public.dumper_history
    for all
    using (true)
    with check (true);

create index if not exists dumper_history_created_at_idx
    on public.dumper_history (created_at desc);
