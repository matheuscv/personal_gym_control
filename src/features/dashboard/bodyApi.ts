import { supabase } from '../../lib/supabaseClient';

export interface BodyReportPoint {
  measured_at: string;
  metrics: Record<string, number | null>;
}

interface BodyReportRow {
  measured_at: string;
  // report_id em body_metrics é unique -> PostgREST trata como relação 1:1
  // e embute um objeto único, não um array.
  body_metrics: Record<string, number | null> | null;
}

export async function fetchBodyProgress(): Promise<BodyReportPoint[]> {
  const { data, error } = await supabase
    .from('body_reports')
    .select('measured_at, body_metrics (*)')
    .order('measured_at')
    .returns<BodyReportRow[]>();
  if (error) throw error;

  return (data ?? []).map((row) => ({
    measured_at: row.measured_at,
    metrics: row.body_metrics ?? {},
  }));
}
