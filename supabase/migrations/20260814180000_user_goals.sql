-- Objetivo do usuário (data de nascimento + peso desejado), usado pra
-- calcular idade e quanto falta para a meta na aba "Meu Objetivo". Uma
-- linha por usuário — owner_id é unique pra permitir upsert direto.
create table public.user_goals (
  id bigint generated always as identity primary key,
  owner_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  birth_date date,
  desired_weight_kg numeric(6, 2),
  updated_at timestamptz not null default now()
);

alter table public.user_goals enable row level security;

create policy "user_goals: usuário gerencia o próprio objetivo"
  on public.user_goals for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
