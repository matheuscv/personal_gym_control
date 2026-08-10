-- Fase 1 — Seção Treino: biblioteca de exercícios, planos A/B/C,
-- sessões realizadas e séries preenchidas. Isolamento por usuário via
-- owner_id denormalizado em todas as tabelas (RLS sem joins, ver
-- supabase-postgres-best-practices: security-rls-performance).

create table public.exercises (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  muscle_group text,
  notes text,
  created_at timestamptz not null default now()
);

create index exercises_owner_id_idx on public.exercises (owner_id);

alter table public.exercises enable row level security;

create policy "exercises: usuário gerencia os próprios exercícios"
  on public.exercises for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Planos de treino (A/B/C)
create table public.workout_plans (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index workout_plans_owner_id_idx on public.workout_plans (owner_id);

alter table public.workout_plans enable row level security;

create policy "workout_plans: usuário gerencia os próprios planos"
  on public.workout_plans for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Exercícios de cada plano, com ordem e alvo de séries/repetições
create table public.workout_plan_exercises (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id bigint not null references public.workout_plans (id) on delete cascade,
  exercise_id bigint not null references public.exercises (id) on delete cascade,
  order_index int not null,
  target_sets int,
  target_reps text,
  created_at timestamptz not null default now(),
  unique (plan_id, order_index)
);

create index workout_plan_exercises_owner_id_idx on public.workout_plan_exercises (owner_id);
create index workout_plan_exercises_plan_id_idx on public.workout_plan_exercises (plan_id);
create index workout_plan_exercises_exercise_id_idx on public.workout_plan_exercises (exercise_id);

alter table public.workout_plan_exercises enable row level security;

create policy "workout_plan_exercises: usuário gerencia os próprios itens de plano"
  on public.workout_plan_exercises for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Um treino realizado em um dia específico (baseado em um plano)
create table public.workout_sessions (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id bigint references public.workout_plans (id) on delete set null,
  session_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index workout_sessions_owner_id_idx on public.workout_sessions (owner_id);
create index workout_sessions_plan_id_idx on public.workout_sessions (plan_id);

alter table public.workout_sessions enable row level security;

create policy "workout_sessions: usuário gerencia as próprias sessões"
  on public.workout_sessions for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Séries preenchidas dentro de uma sessão (peso ou tempo, concluída ou não)
create table public.workout_session_sets (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id bigint not null references public.workout_sessions (id) on delete cascade,
  exercise_id bigint not null references public.exercises (id) on delete cascade,
  plan_exercise_id bigint references public.workout_plan_exercises (id) on delete set null,
  set_number int not null,
  reps int,
  weight_kg numeric(6, 2),
  duration_seconds int,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index workout_session_sets_owner_id_idx on public.workout_session_sets (owner_id);
create index workout_session_sets_session_id_idx on public.workout_session_sets (session_id);
create index workout_session_sets_exercise_id_idx on public.workout_session_sets (exercise_id);
create index workout_session_sets_plan_exercise_id_idx on public.workout_session_sets (plan_exercise_id);

alter table public.workout_session_sets enable row level security;

create policy "workout_session_sets: usuário gerencia as próprias séries"
  on public.workout_session_sets for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
