-- Suporta upsert idempotente no importador de JSON: reimportar um plano
-- com o mesmo nome atualiza em vez de duplicar (mesma lógica para
-- exercícios encontrados por nome).

alter table public.exercises
  add constraint exercises_owner_id_name_key unique (owner_id, name);

alter table public.workout_plans
  add constraint workout_plans_owner_id_name_key unique (owner_id, name);
