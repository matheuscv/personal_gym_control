import { supabase } from '../../lib/supabaseClient';
import { BODY_METRIC_FIELDS } from '../bodyMetricsFields';
import { BODY_MEASUREMENT_FIELDS } from '../bodyMeasurementFields';
import type { CompositionAnalysis } from '../../../api/_lib/importBodyReportSchema';

export type MetricValues = Record<string, number | null>;

export interface BodyReport {
  id: number;
  measured_at: string;
  notes: string | null;
  metrics: MetricValues;
  measurements: MetricValues;
  composition_analysis: CompositionAnalysis | null;
}

interface BodyMetricsRow {
  composition_analysis?: CompositionAnalysis | null;
  [key: string]: unknown;
}

interface BodyReportRow {
  id: number;
  measured_at: string;
  notes: string | null;
  // report_id em body_metrics/body_measurements é unique -> PostgREST trata
  // como relação 1:1 e embute um objeto único, não um array.
  body_metrics: BodyMetricsRow | null;
  body_measurements: MetricValues | null;
}

export async function fetchBodyReports(): Promise<BodyReport[]> {
  const { data, error } = await supabase
    .from('body_reports')
    .select('id, measured_at, notes, body_metrics (*), body_measurements (*)')
    .is('deleted_at', null)
    .order('measured_at', { ascending: false })
    .returns<BodyReportRow[]>();
  if (error) throw error;

  return (data ?? []).map((row) => {
    const { composition_analysis, ...metrics } = row.body_metrics ?? {};
    return {
      id: row.id,
      measured_at: row.measured_at,
      notes: row.notes,
      metrics: metrics as MetricValues,
      measurements: row.body_measurements ?? {},
      composition_analysis: composition_analysis ?? null,
    };
  });
}

export async function upsertBodyReport(input: {
  measured_at: string;
  notes: string | null;
  metrics: MetricValues;
  measurements: MetricValues;
}): Promise<void> {
  const { data: report, error: reportError } = await supabase
    .from('body_reports')
    .upsert({ measured_at: input.measured_at, notes: input.notes }, { onConflict: 'owner_id,measured_at' })
    .select('id')
    .single();
  if (reportError) throw reportError;

  const metricsRow: Record<string, number | null | number> = { report_id: report.id };
  for (const field of BODY_METRIC_FIELDS) {
    metricsRow[field.key] = input.metrics[field.key] ?? null;
  }

  const { error: metricsError } = await supabase
    .from('body_metrics')
    .upsert(metricsRow, { onConflict: 'report_id' });
  if (metricsError) throw metricsError;

  const measurementsRow: Record<string, number | null | number> = { report_id: report.id };
  for (const field of BODY_MEASUREMENT_FIELDS) {
    measurementsRow[field.key] = input.measurements[field.key] ?? null;
  }

  const { error: measurementsError } = await supabase
    .from('body_measurements')
    .upsert(measurementsRow, { onConflict: 'report_id' });
  if (measurementsError) throw measurementsError;
}

// Move pra lixeira em vez de apagar de vez — ver TrashPage/trashApi.
// body_metrics/body_measurements (FK única em report_id) nunca são
// tocados, então reaparecem sozinhos se o relatório for restaurado.
export async function deleteBodyReport(id: number): Promise<void> {
  const { error } = await supabase
    .from('body_reports')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export interface TrashedBodyReport {
  id: number;
  measured_at: string;
  deleted_at: string;
}

export async function fetchTrashedBodyReports(): Promise<TrashedBodyReport[]> {
  const { data, error } = await supabase
    .from('body_reports')
    .select('id, measured_at, deleted_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .returns<TrashedBodyReport[]>();
  if (error) throw error;
  return data ?? [];
}

export async function restoreBodyReport(id: number): Promise<void> {
  const { error } = await supabase.from('body_reports').update({ deleted_at: null }).eq('id', id);
  if (error) throw error;
}

export async function hardDeleteBodyReport(id: number): Promise<void> {
  const { error } = await supabase.from('body_reports').delete().eq('id', id);
  if (error) throw error;
}
