-- Limpeza pontual: séries fantasmas criadas por edições no plano feitas
-- antes de existir a trava de sessão concluída (ver migration
-- 20260817130000). São sempre nunca concluídas e com plan_exercise_id
-- nulo (órfãs, porque o exercício foi removido do plano depois) — o
-- filtro completed = false garante que nenhum dado real preenchido pelo
-- usuário seja apagado.
delete from public.workout_session_sets
where plan_exercise_id is null
  and completed = false
  and session_id in (
    select id from public.workout_sessions where session_date = '2026-08-17'
  );
