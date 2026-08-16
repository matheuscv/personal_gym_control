import { supabase } from '../../lib/supabaseClient';
import type { CompositionAnalysis } from '../../../api/_lib/importBodyReportSchema';

export interface BodyReportPoint {
  measured_at: string;
  metrics: Record<string, number | null>;
  composition_analysis: CompositionAnalysis | null;
}

interface BodyMetricsRow {
  composition_analysis?: CompositionAnalysis | null;
  [key: string]: unknown;
}

interface BodyReportRow {
  measured_at: string;
  // report_id em body_metrics é unique -> PostgREST trata como relação 1:1
  // e embute um objeto único, não um array.
  body_metrics: BodyMetricsRow | null;
}

export async function fetchBodyProgress(): Promise<BodyReportPoint[]> {
  const { data, error } = await supabase
    .from('body_reports')
    .select('measured_at, body_metrics (*)')
    .order('measured_at')
    .returns<BodyReportRow[]>();
  if (error) throw error;

  return (data ?? []).map((row) => {
    const { composition_analysis, ...metrics } = row.body_metrics ?? {};
    return {
      measured_at: row.measured_at,
      metrics: metrics as Record<string, number | null>,
      composition_analysis: composition_analysis ?? null,
    };
  });
}
