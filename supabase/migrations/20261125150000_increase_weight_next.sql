-- Marca, na última série de um exercício, se o usuário sinalizou "aumentar
-- peso no próximo treino" — carregado pra próxima execução do mesmo
-- exercício (ver loadDailyWorkout) exatamente como o resto do "setup"
-- (reps/peso/tempo da última série), não reseta sozinho: só muda quando o
-- usuário desmarca explicitamente.
alter table public.workout_session_sets add column increase_weight_next boolean not null default false;
