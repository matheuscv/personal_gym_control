-- Exercícios de cardio (Esteira, Bike, Elíptico, Escada, Remo, HIIT bike)
-- passam a registrar Duração/Distância/Inclinação/Calorias em vez de
-- Reps/Peso/Tempo. Duração reaproveita duration_seconds (já existente);
-- Distância, Inclinação e Calorias são colunas novas.

alter table public.exercises
  add column metric_type text not null default 'strength'
    check (metric_type in ('strength', 'cardio'));

alter table public.workout_session_sets
  add column distance_km numeric(5, 2),
  add column incline_degree numeric(4, 1),
  add column calories int;

update public.exercises
  set metric_type = 'cardio'
  where name in (
    'Esteira (caminhada/corrida)',
    'Bicicleta ergométrica',
    'Elíptico',
    'Escada (stairmaster)',
    'Remo ergométrico',
    'HIIT em bike (intervalado)'
  );

-- Dias não concluídos: reps/peso desses exercícios não têm mais sentido no
-- novo modelo. Dias já concluídos ficam intocados (histórico imutável).
update public.workout_session_sets s
  set reps = null, weight_kg = null
  from public.workout_sessions ws, public.exercises e
  where s.session_id = ws.id
    and s.exercise_id = e.id
    and ws.completed_at is null
    and e.metric_type = 'cardio';

-- Sessões de dias passados (não concluídos) já têm um snapshot congelado em
-- locked_plan_exercises — precisa carregar metric_type nele também, senão a
-- tela continuaria decidindo pelo formato antigo pra esses dias.
update public.workout_sessions ws
  set locked_plan_exercises = (
    select jsonb_agg(
      case when (elem ->> 'exercise_id')::bigint in (select id from public.exercises where metric_type = 'cardio')
        then elem || jsonb_build_object('metric_type', 'cardio')
        else elem
      end
    )
    from jsonb_array_elements(ws.locked_plan_exercises) as elem
  )
  where ws.completed_at is null
    and ws.locked_plan_exercises is not null;
