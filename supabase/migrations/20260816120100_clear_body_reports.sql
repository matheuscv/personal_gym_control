-- A pedido do usuário: limpa os relatórios corporais existentes (importados
-- antes da coluna composition_analysis existir) para reimportação com o
-- novo formato de JSON, capturando faixa de referência e avaliação.
delete from public.body_reports;
