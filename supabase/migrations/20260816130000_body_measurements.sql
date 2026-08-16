-- Evolução Corporal: medidas perimétricas (fita métrica), preenchidas só
-- manualmente em Criar/Editar Relatório — não vêm do relatório de
-- bioimpedância (Fitdays), então ficam numa tabela própria, mesma relação
-- 1:1 com body_reports que body_metrics já usa.
create table public.body_measurements (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  report_id bigint not null unique references public.body_reports (id) on delete cascade,
  -- Tronco
  peito_torax_cm numeric(5, 2),
  cintura_cm numeric(5, 2),
  abdomen_quadril_cm numeric(5, 2),
  -- Membros superiores
  biceps_direito_cm numeric(5, 2),
  biceps_esquerdo_cm numeric(5, 2),
  biceps_relaxado_direito_cm numeric(5, 2),
  biceps_relaxado_esquerdo_cm numeric(5, 2),
  antebraco_direito_cm numeric(5, 2),
  antebraco_esquerdo_cm numeric(5, 2),
  -- Membros inferiores
  coxa_direita_cm numeric(5, 2),
  coxa_esquerda_cm numeric(5, 2),
  coxa_medial_direita_cm numeric(5, 2),
  coxa_medial_esquerda_cm numeric(5, 2),
  panturrilha_direita_cm numeric(5, 2),
  panturrilha_esquerda_cm numeric(5, 2),
  created_at timestamptz not null default now()
);

create index body_measurements_owner_id_idx on public.body_measurements (owner_id);
create index body_measurements_report_id_idx on public.body_measurements (report_id);

alter table public.body_measurements enable row level security;

create policy "body_measurements: usuário gerencia as próprias medidas"
  on public.body_measurements for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
