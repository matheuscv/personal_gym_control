import { supabase } from '../lib/supabaseClient';
import {
  fetchTrashedPlanExercises,
  fetchTrashedPlans,
  hardDeletePlan,
  hardDeletePlanExercise,
  restorePlan,
  restorePlanExercise,
} from './admin/api';
import {
  fetchTrashedBodyReports,
  hardDeleteBodyReport,
  restoreBodyReport,
} from './admin/bodyReportApi';
import { formatShortDate } from '../lib/date';

export type TrashItemKind = 'plan' | 'plan_exercise' | 'body_report';

export interface TrashItem {
  kind: TrashItemKind;
  id: number;
  label: string;
  detail: string | null;
  deletedAt: string;
}

export const TRASH_RETENTION_DAYS = 30;

export async function fetchTrashItems(): Promise<TrashItem[]> {
  const [plans, planExercises, bodyReports] = await Promise.all([
    fetchTrashedPlans(),
    fetchTrashedPlanExercises(),
    fetchTrashedBodyReports(),
  ]);

  const items: TrashItem[] = [
    ...plans.map((plan): TrashItem => ({
      kind: 'plan',
      id: plan.id,
      label: plan.name,
      detail: null,
      deletedAt: plan.deleted_at,
    })),
    ...planExercises.map((pe): TrashItem => ({
      kind: 'plan_exercise',
      id: pe.id,
      label: pe.exercise_name,
      detail: `Plano: ${pe.plan_name}`,
      deletedAt: pe.deleted_at,
    })),
    ...bodyReports.map((report): TrashItem => ({
      kind: 'body_report',
      id: report.id,
      label: `Relatório de ${formatShortDate(report.measured_at)}`,
      detail: null,
      deletedAt: report.deleted_at,
    })),
  ];

  return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

export async function restoreTrashItem(kind: TrashItemKind, id: number): Promise<void> {
  if (kind === 'plan') return restorePlan(id);
  if (kind === 'plan_exercise') return restorePlanExercise(id);
  return restoreBodyReport(id);
}

export async function hardDeleteTrashItem(kind: TrashItemKind, id: number): Promise<void> {
  if (kind === 'plan') return hardDeletePlan(id);
  if (kind === 'plan_exercise') return hardDeletePlanExercise(id);
  return hardDeleteBodyReport(id);
}

// Purga definitiva (lazy, sem cron) do que já passou da validade — chamada
// ao abrir a tela da Lixeira. Mesmo padrão de limpeza oportunista já usado
// em workout/api.ts (loadDailyWorkout) pra séries órfãs.
export async function purgeExpiredTrash(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - TRASH_RETENTION_DAYS);
  const cutoffIso = cutoff.toISOString();

  await Promise.all([
    supabase.from('workout_plans').delete().lt('deleted_at', cutoffIso),
    supabase.from('workout_plan_exercises').delete().lt('deleted_at', cutoffIso),
    supabase.from('body_reports').delete().lt('deleted_at', cutoffIso),
  ]);
}
