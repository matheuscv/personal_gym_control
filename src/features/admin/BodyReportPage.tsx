import { type FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BODY_METRIC_FIELDS } from '../bodyMetricsFields';
import { deleteBodyReport, fetchBodyReports, upsertBodyReport, type BodyReport } from './bodyReportApi';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyValues(): Record<string, string> {
  return Object.fromEntries(BODY_METRIC_FIELDS.map((field) => [field.key, '']));
}

export function BodyReportPage() {
  const queryClient = useQueryClient();
  const reportsQuery = useQuery({ queryKey: ['admin-body-reports'], queryFn: fetchBodyReports });

  const [measuredAt, setMeasuredAt] = useState(today());
  const [notes, setNotes] = useState('');
  const [values, setValues] = useState<Record<string, string>>(emptyValues());
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin-body-reports'] });
    queryClient.invalidateQueries({ queryKey: ['body-progress'] });
  }

  const saveMutation = useMutation({
    mutationFn: upsertBodyReport,
    onSuccess: () => {
      invalidate();
      setMeasuredAt(today());
      setNotes('');
      setValues(emptyValues());
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({ mutationFn: deleteBodyReport, onSuccess: invalidate });

  function loadForEdit(report: BodyReport) {
    setMeasuredAt(report.measured_at);
    setNotes(report.notes ?? '');
    const next = emptyValues();
    for (const field of BODY_METRIC_FIELDS) {
      const value = report.metrics[field.key];
      next[field.key] = value == null ? '' : String(value);
    }
    setValues(next);
    setError(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const metrics: Record<string, number | null> = {};
    for (const field of BODY_METRIC_FIELDS) {
      const raw = values[field.key]?.trim();
      if (!raw) {
        metrics[field.key] = null;
        continue;
      }
      const parsed = Number(raw);
      if (Number.isNaN(parsed)) {
        setError(`${field.label}: valor inválido.`);
        return;
      }
      metrics[field.key] = parsed;
    }

    saveMutation.mutate({ measured_at: measuredAt, notes: notes.trim() || null, metrics });
  }

  return (
    <div className="admin-section">
      <h2 className="section-title">Relatório de composição corporal</h2>

      <form className="body-report-form" onSubmit={handleSubmit}>
        <label>
          Data da medição
          <input type="date" value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)} required />
        </label>

        <div className="body-report-grid">
          {BODY_METRIC_FIELDS.map((field) => (
            <label key={field.key}>
              {field.label} {field.unit && <span className="field-unit">({field.unit})</span>}
              <input
                type="number"
                step="0.01"
                value={values[field.key] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>

        <label>
          Notas (opcional)
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {error && <p className="admin-error">{error}</p>}

        <button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Salvando...' : 'Salvar relatório'}
        </button>
      </form>

      <h3 className="section-title">Relatórios registrados</h3>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Peso (kg)</th>
            <th>IMC</th>
            <th>Gordura (%)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {reportsQuery.data?.map((report) => (
            <tr key={report.id}>
              <td>{report.measured_at}</td>
              <td>{report.metrics.peso_kg ?? '—'}</td>
              <td>{report.metrics.imc ?? '—'}</td>
              <td>{report.metrics.gordura_corporal_pct ?? '—'}</td>
              <td>
                <button type="button" onClick={() => loadForEdit(report)}>
                  Editar
                </button>
                <button type="button" onClick={() => deleteMutation.mutate(report.id)}>
                  Remover
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
