-- Permite cancelar o treino de um dia específico (futuro) sem alterar a
-- agenda semanal recorrente — mesma lógica de "sessão já existente manda
-- no plano de fato usado nesse dia", só que agora uma sessão pode marcar
-- explicitamente "não vou treinar neste dia", mesmo que a agenda (ou um
-- treino avulso anterior) dissesse o contrário.
alter table public.workout_sessions add column canceled_at timestamptz;
