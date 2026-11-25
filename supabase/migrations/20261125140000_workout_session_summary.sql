-- Resumo opcional do dia, capturado ao concluir o Treino do dia — nenhum
-- desses dados pertence a um exercício específico, por isso vive direto
-- em workout_sessions (mesmo padrão de completed_at/canceled_at: tudo
-- nullable, nada obrigatório).
alter table public.workout_sessions
  add column duration_minutes int,
  add column calories int,
  add column heart_rate_avg int,
  add column heart_rate_max int,
  add column mood text check (mood in ('exhausted', 'tired', 'good', 'excellent'));
