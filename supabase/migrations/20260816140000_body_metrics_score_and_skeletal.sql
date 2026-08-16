-- Auditoria dos gráficos do relatório de referência: faltavam dois campos
-- do Fitdays que nunca tinham sido capturados — a pontuação corporal geral
-- (0-100+) e a massa de músculo esquelético (kg), distinta da massa
-- muscular total.
alter table public.body_metrics
  add column pontuacao_corporal int,
  add column musculo_esqueletico_kg numeric(6, 2);
