-- Agenda semanal: qual plano treinar em cada dia da semana. day_of_week usa
-- a mesma convenção de Date.getDay() no client (0=domingo..6=sábado), pra
-- não precisar converter ao consultar "o plano de hoje".
create table public.workout_weekly_schedule (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  plan_id bigint not null references public.workout_plans (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_id, day_of_week)
);

create index workout_weekly_schedule_owner_id_idx on public.workout_weekly_schedule (owner_id);
create index workout_weekly_schedule_plan_id_idx on public.workout_weekly_schedule (plan_id);

alter table public.workout_weekly_schedule enable row level security;

create policy "workout_weekly_schedule: usuário gerencia a própria agenda"
  on public.workout_weekly_schedule for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
