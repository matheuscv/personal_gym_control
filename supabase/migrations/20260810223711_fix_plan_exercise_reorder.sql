-- A troca de order_index entre dois exercícios de um plano batia contra a
-- constraint unique(plan_id, order_index) ao atualizar a primeira linha,
-- pois o valor alvo ainda estava ocupado pela segunda. Torna a constraint
-- deferrable (checada só no fim da transação) e move a troca para uma
-- função executada em uma única transação.

alter table public.workout_plan_exercises
  drop constraint workout_plan_exercises_plan_id_order_index_key;

alter table public.workout_plan_exercises
  add constraint workout_plan_exercises_plan_id_order_index_key
  unique (plan_id, order_index) deferrable initially deferred;

create function public.swap_plan_exercise_order(id_a bigint, id_b bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  order_a int;
  order_b int;
begin
  select order_index into order_a from public.workout_plan_exercises where id = id_a;
  select order_index into order_b from public.workout_plan_exercises where id = id_b;

  update public.workout_plan_exercises set order_index = order_b where id = id_a;
  update public.workout_plan_exercises set order_index = order_a where id = id_b;
end;
$$;
