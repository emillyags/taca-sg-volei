-- TAÇA SG VÔLEI 2026 — SUPABASE
create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('fem','masc')),
  created_at timestamptz default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('fem','masc')),
  match_time time,
  court text,
  team_a uuid references public.teams(id) on delete set null,
  team_b uuid references public.teams(id) on delete set null,
  sets_a integer not null default 0,
  sets_b integer not null default 0,
  status text not null default 'Agendado' check (status in ('Agendado','Ao vivo','Finalizado')),
  created_at timestamptz default now()
);

alter table public.teams enable row level security;
alter table public.matches enable row level security;

drop policy if exists "public can read teams" on public.teams;
create policy "public can read teams" on public.teams for select using (true);

drop policy if exists "public can read matches" on public.matches;
create policy "public can read matches" on public.matches for select using (true);

drop policy if exists "authenticated can manage teams" on public.teams;
create policy "authenticated can manage teams" on public.teams
for all to authenticated using (true) with check (true);

drop policy if exists "authenticated can manage matches" on public.matches;
create policy "authenticated can manage matches" on public.matches
for all to authenticated using (true) with check (true);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='teams') then
    alter publication supabase_realtime add table public.teams;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='matches') then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;


-- PATROCINADORES

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text not null,
  logo_path text,
  position integer not null default 0,
  created_at timestamptz default now()
);

alter table public.sponsors enable row level security;

drop policy if exists "public can read sponsors" on public.sponsors;
create policy "public can read sponsors" on public.sponsors
for select using (true);

drop policy if exists "authenticated can manage sponsors" on public.sponsors;
create policy "authenticated can manage sponsors" on public.sponsors
for all to authenticated using (true) with check (true);

-- Bucket público para as logos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sponsor-logos',
  'sponsor-logos',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp','image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can view sponsor logos" on storage.objects;
create policy "public can view sponsor logos" on storage.objects
for select using (bucket_id = 'sponsor-logos');

drop policy if exists "authenticated can upload sponsor logos" on storage.objects;
create policy "authenticated can upload sponsor logos" on storage.objects
for insert to authenticated with check (bucket_id = 'sponsor-logos');

drop policy if exists "authenticated can update sponsor logos" on storage.objects;
create policy "authenticated can update sponsor logos" on storage.objects
for update to authenticated using (bucket_id = 'sponsor-logos') with check (bucket_id = 'sponsor-logos');

drop policy if exists "authenticated can delete sponsor logos" on storage.objects;
create policy "authenticated can delete sponsor logos" on storage.objects
for delete to authenticated using (bucket_id = 'sponsor-logos');

-- Adiciona ao Realtime somente se ainda não estiver incluída.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sponsors'
  ) then
    alter publication supabase_realtime add table public.sponsors;
  end if;
end $$;
-- TAÇA SG VÔLEI 2026 — REGRAS DO CAMPEONATO
-- Execute UMA VEZ no SQL Editor do Supabase.

alter table public.teams
  add column if not exists group_code text;

alter table public.teams
  drop constraint if exists teams_group_code_check;
alter table public.teams
  add constraint teams_group_code_check check (group_code is null or group_code in ('A','B'));

alter table public.matches
  add column if not exists phase text not null default 'Grupo',
  add column if not exists set1_a integer not null default 0,
  add column if not exists set1_b integer not null default 0,
  add column if not exists set2_a integer not null default 0,
  add column if not exists set2_b integer not null default 0,
  add column if not exists set3_a integer not null default 0,
  add column if not exists set3_b integer not null default 0;

alter table public.matches
  drop constraint if exists matches_phase_check;
alter table public.matches
  add constraint matches_phase_check check (phase in ('Grupo','Desempate','Semifinal','Final'));

-- Índices para agilizar consultas do site.
create index if not exists idx_teams_category_group on public.teams(category, group_code);
create index if not exists idx_matches_category_phase on public.matches(category, phase);
