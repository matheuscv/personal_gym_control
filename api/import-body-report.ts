import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const bodyReportSchema = z.object({
  measured_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD)'),
  notes: z.string().trim().min(1).nullish(),
  peso_kg: z.number().positive().nullish(),
  imc: z.number().positive().nullish(),
  gordura_corporal_pct: z.number().min(0).max(100).nullish(),
  massa_muscular_kg: z.number().positive().nullish(),
  massa_ossea_kg: z.number().positive().nullish(),
  agua_corporal_pct: z.number().min(0).max(100).nullish(),
  proteina_pct: z.number().min(0).max(100).nullish(),
  gordura_visceral: z.number().min(0).nullish(),
  tmb_kcal: z.number().positive().nullish(),
  peso_livre_gordura_kg: z.number().positive().nullish(),
  gordura_subcutanea_pct: z.number().min(0).max(100).nullish(),
  smi_kg_m2: z.number().positive().nullish(),
  idade_corporal: z.number().int().positive().nullish(),
  whr: z.number().positive().nullish(),
  peso_alvo_kg: z.number().positive().nullish(),
  peso_ideal_kg: z.number().positive().nullish(),
  controle_peso_kg: z.number().nullish(),
  grau_obesidade_pct: z.number().nullish(),
});

function supabaseForRequest(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Variáveis de ambiente do Supabase ausentes no servidor.');
  }

  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function fetch(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  const supabase = supabaseForRequest(req);
  if (!supabase) {
    return json({ error: 'Não autenticado.' }, 401);
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  const parsed = bodyReportSchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ error: 'Validação falhou.', issues: parsed.error.issues }, 400);
  }
  const { measured_at, notes, ...metrics } = parsed.data;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Sessão inválida.' }, 401);
  }

  const { data: report, error: reportError } = await supabase
    .from('body_reports')
    .upsert({ measured_at, notes: notes ?? null }, { onConflict: 'owner_id,measured_at' })
    .select('id')
    .single();
  if (reportError) {
    return json({ error: `Falha ao gravar relatório: ${reportError.message}` }, 500);
  }

  const { error: metricsError } = await supabase
    .from('body_metrics')
    .upsert({ report_id: report.id, ...metrics }, { onConflict: 'report_id' });
  if (metricsError) {
    return json({ error: `Falha ao gravar índices: ${metricsError.message}` }, 500);
  }

  return json({ report_id: report.id, measured_at }, 200);
}
