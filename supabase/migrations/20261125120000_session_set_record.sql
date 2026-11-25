-- Marca a série como um novo "recorde de setup" (reps/peso/tempo melhor
-- que a última vez que esse exercício foi feito) no momento em que a
-- última série do exercício é concluída. Persistido (não recalculado
-- depois) pra funcionar tanto no card do exercício quanto no calendário
-- sem precisar reprocessar o histórico inteiro.
alter table public.workout_session_sets add column is_record boolean not null default false;
