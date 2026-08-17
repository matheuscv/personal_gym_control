-- Congela a lista de exercícios do plano por sessão, uma vez que ela
-- deixe de ser "hoje, ainda em aberto" — editar o plano não deve mudar a
-- visão de dias passados nem de um dia de hoje já concluído (mesmo se
-- reaberto). Nula enquanto a sessão ainda reflete o plano ao vivo.
alter table public.workout_sessions
  add column locked_plan_exercises jsonb;
