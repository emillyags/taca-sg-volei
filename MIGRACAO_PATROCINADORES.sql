-- TAÇA SG VÔLEI 2026 — ADICIONAR PATROCINADORES
-- Execute este arquivo UMA VEZ no SQL Editor do Supabase do site já publicado.

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
