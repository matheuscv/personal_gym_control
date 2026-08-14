import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { BODY_METRIC_FIELDS } from '../bodyMetricsFields';
import { fetchBodyReports, upsertBodyReport } from './bodyReportApi';
import './CreateBodyReportPage.css';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyValues(): Record<string, string> {
  return Object.fromEntries(BODY_METRIC_FIELDS.map((field) => [field.key, '']));
}

export function CreateBodyReportPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const reportsQuery = useQuery({ queryKey: ['admin-body-reports'], queryFn: fetchBodyReports });
  const editingReport = editId ? reportsQuery.data?.find((r) => r.id === Number(editId)) : undefined;

  const [measuredAt, setMeasuredAt] = useState(today());
  const [notes, setNotes] = useState('');
  const [values, setValues] = useState<Record<string, string>>(emptyValues());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);

  useEffect(() => {
    if (!editingReport || loadedFor === editingReport.id) return;
    setMeasuredAt(editingReport.measured_at);
    setNotes(editingReport.notes ?? '');
    const next = emptyValues();
    for (const field of BODY_METRIC_FIELDS) {
      const value = editingReport.metrics[field.key];
      next[field.key] = value == null ? '' : String(value);
    }
    setValues(next);
    setLoadedFor(editingReport.id);
  }, [editingReport, loadedFor]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin-body-reports'] });
    queryClient.invalidateQueries({ queryKey: ['body-progress'] });
  }

  const saveMutation = useMutation({
    mutationFn: upsertBodyReport,
    onSuccess: () => {
      invalidate();
      setSuccess(editingReport ? 'Relatório atualizado.' : 'Relatório criado.');
      setTimeout(() => navigate('/admin/body-report'), 900);
    },
    onError: (err: Error) => setError(err.message),
  });

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

  const heading = editingReport
    ? `Editar relatório de ${new Date(`${editingReport.measured_at}T00:00:00`).toLocaleDateString('pt-BR')}`
    : 'Criar relatório';

  return (
    <div className="admin-section create-body-report">
      <span className="create-body-report-eyebrow">Composição corporal</span>
      <h2 className="section-title">{heading}</h2>
      <p className="import-hint">
        Preencha manualmente os índices do relatório. Só a data é obrigatória — o resto pode ficar em branco.
      </p>

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
        {success && <p className="import-success">{success}</p>}

        <button type="submit" className="btn-primary" disabled={saveMutation.isPending}>
          <Save size={16} />
          {saveMutation.isPending ? 'Salvando...' : editingReport ? 'Salvar alterações' : 'Criar relatório'}
        </button>
      </form>
    </div>
  );
}
