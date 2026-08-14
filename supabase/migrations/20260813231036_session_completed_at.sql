-- Marca o momento em que o usuário encerra explicitamente o treino do dia
-- (botão "Concluir treino do dia"), independente de todas as séries terem
-- sido marcadas como feitas. null = sessão ainda em andamento. Serve de base
-- para a futura seção de evolução considerar dias "fechados" pelo usuário.
alter table public.workout_sessions add column completed_at timestamptz;
