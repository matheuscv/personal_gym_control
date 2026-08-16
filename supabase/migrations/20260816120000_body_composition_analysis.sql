-- Evolução Corporal: tabela "Análise da composição corporal" do relatório
-- Fitdays traz, por métrica, uma faixa de referência (min-max) e um rótulo
-- de avaliação (ex.: "Alto", "Excelente"). Esses dados só existem na foto/
-- PDF original, então só chegam via importação de JSON (extraídos pelo
-- Claude) — relatórios criados manualmente ficam sem essa informação.
alter table public.body_metrics
  add column composition_analysis jsonb;

comment on column public.body_metrics.composition_analysis is
  'Faixas de referência e avaliação por métrica (peso, massa_gorda, massa_ossea, massa_proteica, agua_corporal, massa_muscular), capturadas na importação do relatório. Formato: {"<metrica>": {"min": number, "max": number, "avaliacao": string}}. Nula em relatórios criados manualmente.';
