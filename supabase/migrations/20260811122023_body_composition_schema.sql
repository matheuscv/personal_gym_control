-- Fase 2 — Seção Evolução Corporal: relatórios de composição corporal
-- (bioimpedância, ex. balança Fitdays). Sem armazenamento de imagem —
-- apenas os dados numéricos extraídos via chat com o Claude ou
-- digitados manualmente.

create table public.body_reports (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_at date not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (owner_id, measured_at)
);

create index body_reports_owner_id_idx on public.body_reports (owner_id);

alter table public.body_reports enable row level security;

create policy "body_reports: usuário gerencia os próprios relatórios"
  on public.body_reports for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Índices de um relatório (relação 1:1 com body_reports)
create table public.body_metrics (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  report_id bigint not null unique references public.body_reports (id) on delete cascade,
  peso_kg numeric(6, 2),
  imc numeric(5, 2),
  gordura_corporal_pct numeric(5, 2),
  massa_muscular_kg numeric(6, 2),
  massa_ossea_kg numeric(5, 2),
  agua_corporal_pct numeric(5, 2),
  proteina_pct numeric(5, 2),
  gordura_visceral numeric(5, 2),
  tmb_kcal numeric(7, 2),
  peso_livre_gordura_kg numeric(6, 2),
  gordura_subcutanea_pct numeric(5, 2),
  smi_kg_m2 numeric(5, 2),
  idade_corporal int,
  whr numeric(4, 2),
  peso_alvo_kg numeric(6, 2),
  peso_ideal_kg numeric(6, 2),
  controle_peso_kg numeric(6, 2),
  grau_obesidade_pct numeric(5, 2),
  created_at timestamptz not null default now()
);

create index body_metrics_owner_id_idx on public.body_metrics (owner_id);
create index body_metrics_report_id_idx on public.body_metrics (report_id);

alter table public.body_metrics enable row level security;

create policy "body_metrics: usuário gerencia os próprios índices"
  on public.body_metrics for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
