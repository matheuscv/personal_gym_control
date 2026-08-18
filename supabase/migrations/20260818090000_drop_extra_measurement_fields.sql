-- A pedido do usuário: Bíceps relaxado (dir/esq) e Coxa medial (dir/esq)
-- saem de vez da Evolução Corporal — nunca eram bem preenchidos e
-- duplicavam a informação de Bíceps/Coxa "normal".
alter table public.body_measurements
  drop column biceps_relaxado_direito_cm,
  drop column biceps_relaxado_esquerdo_cm,
  drop column coxa_medial_direita_cm,
  drop column coxa_medial_esquerda_cm;
