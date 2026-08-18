-- Comentário livre por exercício dentro do treino do dia (um por sessão +
-- exercício do plano) — não referencia workout_plan_exercises com FK
-- porque sessões travadas/históricas podem apontar pra um plan_exercise_id
-- que já não existe mais (mesmo motivo de workout_session_sets.plan_exercise_id).
create table public.workout_session_exercise_notes (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id bigint not null references public.workout_sessions (id) on delete cascade,
  plan_exercise_id bigint not null,
  note text,
  updated_at timestamptz not null default now(),
  unique (session_id, plan_exercise_id)
);

create index workout_session_exercise_notes_owner_id_idx on public.workout_session_exercise_notes (owner_id);
create index workout_session_exercise_notes_session_id_idx on public.workout_session_exercise_notes (session_id);

alter table public.workout_session_exercise_notes enable row level security;

create policy "workout_session_exercise_notes: usuário gerencia as próprias notas"
  on public.workout_session_exercise_notes for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
