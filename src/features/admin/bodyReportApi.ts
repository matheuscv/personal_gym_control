import { supabase } from '../../lib/supabaseClient';
import { BODY_METRIC_FIELDS } from '../bodyMetricsFields';
import type { CompositionAnalysis } from '../../../api/_lib/importBodyReportSchema';

export type MetricValues = Record<string, number | null>;

export interface BodyReport {
  id: number;
  measured_at: string;
  notes: string | null;
  metrics: MetricValues;
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
  // report_id em body_metrics é unique -> PostgREST trata como relação 1:1
  // e embute um objeto único, não um array.
  body_metrics: BodyMetricsRow | null;
}

export async function fetchBodyReports(): Promise<BodyReport[]> {
  const { data, error } = await supabase
    .from('body_reports')
    .select('id, measured_at, notes, body_metrics (*)')
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
      composition_analysis: composition_analysis ?? null,
    };
  });
}

export async function upsertBodyReport(input: {
  measured_at: string;
  notes: string | null;
  metrics: MetricValues;
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
}

export async function deleteBodyReport(id: number): Promise<void> {
  const { error } = await supabase.from('body_reports').delete().eq('id', id);
  if (error) throw error;
}
