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
