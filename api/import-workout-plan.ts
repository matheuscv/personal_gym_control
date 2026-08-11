import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/node';
import { z } from 'zod';

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.2 });
}

const importPlanExerciseSchema = z.object({
  name: z.string().trim().min(1, 'Nome do exercício é obrigatório'),
  muscle_group: z.string().trim().min(1).nullish(),
  target_sets: z.number().int().positive().nullish(),
  target_reps: z.string().trim().min(1).nullish(),
});

const importPlanSchema = z.object({
  name: z.string().trim().min(1, 'Nome do plano é obrigatório'),
  exercises: z.array(importPlanExerciseSchema).min(1, 'Informe ao menos um exercício'),
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
  try {
    return await handleRequest(req);
  } catch (err) {
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return json({ error: 'Erro interno do servidor.' }, 500);
  }
}

async function handleRequest(req: Request): Promise<Response> {
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

  const parsed = importPlanSchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ error: 'Validação falhou.', issues: parsed.error.issues }, 400);
  }
  const input = parsed.data;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Sessão inválida.' }, 401);
  }

  const exerciseRows = input.exercises.map((exercise) => ({
    name: exercise.name,
    muscle_group: exercise.muscle_group ?? null,
  }));

  const { data: upsertedExercises, error: exercisesError } = await supabase
    .from('exercises')
    .upsert(exerciseRows, { onConflict: 'owner_id,name' })
    .select('id, name');
  if (exercisesError) {
    return json({ error: `Falha ao gravar exercícios: ${exercisesError.message}` }, 500);
  }

  const exerciseIdByName = new Map((upsertedExercises ?? []).map((e) => [e.name, e.id as number]));

  const { data: plan, error: planError } = await supabase
    .from('workout_plans')
    .upsert({ name: input.name, is_active: true }, { onConflict: 'owner_id,name' })
    .select('id, name')
    .single();
  if (planError) {
    return json({ error: `Falha ao gravar plano: ${planError.message}` }, 500);
  }

  const { error: deleteError } = await supabase
    .from('workout_plan_exercises')
    .delete()
    .eq('plan_id', plan.id);
  if (deleteError) {
    return json({ error: `Falha ao limpar exercícios do plano: ${deleteError.message}` }, 500);
  }

  const planExerciseRows = input.exercises.map((exercise, index) => ({
    plan_id: plan.id,
    exercise_id: exerciseIdByName.get(exercise.name),
    order_index: index + 1,
    target_sets: exercise.target_sets ?? null,
    target_reps: exercise.target_reps ?? null,
  }));

  const { error: insertError } = await supabase.from('workout_plan_exercises').insert(planExerciseRows);
  if (insertError) {
    return json({ error: `Falha ao gravar exercícios do plano: ${insertError.message}` }, 500);
  }

  return json({ plan_id: plan.id, plan_name: plan.name, exercises_count: planExerciseRows.length }, 200);
}
