-- Corrige a causa raiz de sessões duplicadas pra mesma data: até aqui só
-- havia uma verificação "existe sessão?" antes de inserir, sem nenhuma
-- trava no banco — duas chamadas quase simultâneas (ex.: duas abas, ou
-- uma corrida entre o carregamento normal do dia e outra ação) podiam
-- ambas ver "não existe" e inserir, criando 2 linhas pra mesma data.
--
-- Primeiro limpa duplicatas que já existirem, mantendo a linha mais
-- "informativa" por data (concluída > cancelada > mais série > a mais
-- antiga como critério de desempate) — nenhuma delas tinha dados reais
-- de treino preenchidos (são de dias futuros/race, nunca chegaram a ser
-- treinados), então apagar as demais não perde histórico de verdade.
with ranked as (
  select
    id,
    row_number() over (
      partition by owner_id, session_date
      order by (completed_at is not null) desc, (canceled_at is not null) desc, id asc
    ) as rn
  from public.workout_sessions
)
delete from public.workout_sessions ws
using ranked
where ws.id = ranked.id and ranked.rn > 1;

alter table public.workout_sessions
  add constraint workout_sessions_owner_date_unique unique (owner_id, session_date);
