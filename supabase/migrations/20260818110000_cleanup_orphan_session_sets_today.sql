-- Mesma limpeza pontual da migration 20260817140000, dessa vez pra sessão
-- de 2026-08-18: 3 séries fantasmas de "Elevação de quadril (hip thrust)",
-- removido do plano depois que a sessão já existia, com plan_exercise_id
-- nulo (on delete set null) e nunca concluídas — inflavam o total do
-- percentual do dia sem nunca poderem ser marcadas na tela. A sessão já
-- estava travada (concluída) antes do fix automático em loadDailyWorkout
-- (ver commit 4830ddb), que só age em sessões ainda vivas.
delete from public.workout_session_sets
where plan_exercise_id is null
  and completed = false
  and session_id in (
    select id from public.workout_sessions where session_date = '2026-08-18'
  );
