-- A pedido do usuário: exercícios já configurados nos planos com o alvo
-- padrão antigo (10-12 reps) passam para o novo padrão (12-15 reps).
-- Não mexe em exercícios com um alvo diferente, configurado manualmente.
update public.workout_plan_exercises
set target_reps = '12-15'
where target_reps = '10-12';
