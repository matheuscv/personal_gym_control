-- Lixeira (soft delete) para as 3 exclusões do usuário que já pedem
-- confirmação (plano, exercício de um plano, relatório corporal) — em vez
-- de apagar de vez, marca deleted_at e deixa restaurar por um período.
-- Nenhuma FK/cascade existente precisa mudar: soft delete nunca chama
-- DELETE nessas linhas, então o cascade físico não entra em jogo mais
-- para essas 3 ações (continua valendo pra outras, ex.: reimportação).
alter table public.workout_plans add column deleted_at timestamptz;
alter table public.workout_plan_exercises add column deleted_at timestamptz;
alter table public.body_reports add column deleted_at timestamptz;

-- Timer de descanso entre séries, configurável por exercício do plano.
-- Default no banco (90s) pra todo caminho de inserção existente (Criar
-- Plano, biblioteca, import JSON) já nascer com um valor sensato, editável
-- depois sem precisar mudar código nenhum desses caminhos de insert.
alter table public.workout_plan_exercises add column rest_seconds int not null default 90;
