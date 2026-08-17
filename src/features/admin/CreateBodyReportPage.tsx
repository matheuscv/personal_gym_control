import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ruler, Save, Scale, StickyNote } from 'lucide-react';
import { BODY_METRIC_FIELDS, type BodyMetricField } from '../bodyMetricsFields';
import { BODY_MEASUREMENT_FIELDS, MEASUREMENT_GROUPS, type BodyMeasurementField } from '../bodyMeasurementFields';
import { fetchBodyReports, upsertBodyReport } from './bodyReportApi';
import { formatShortDate } from '../../lib/date';
import './CreateBodyReportPage.css';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyValues(fields: { key: string }[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, '']));
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
  const [values, setValues] = useState<Record<string, string>>(emptyValues(BODY_METRIC_FIELDS));
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>(
    emptyValues(BODY_MEASUREMENT_FIELDS)
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);

  useEffect(() => {
    if (!editingReport || loadedFor === editingReport.id) return;
    setMeasuredAt(editingReport.measured_at);
    setNotes(editingReport.notes ?? '');

    const nextMetrics = emptyValues(BODY_METRIC_FIELDS);
    for (const field of BODY_METRIC_FIELDS) {
      const value = editingReport.metrics[field.key];
      nextMetrics[field.key] = value == null ? '' : String(value);
    }
    setValues(nextMetrics);

    const nextMeasurements = emptyValues(BODY_MEASUREMENT_FIELDS);
    for (const field of BODY_MEASUREMENT_FIELDS) {
      const value = editingReport.measurements[field.key];
      nextMeasurements[field.key] = value == null ? '' : String(value);
    }
    setMeasurementValues(nextMeasurements);

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

  function parseValues(
    source: Record<string, string>,
    fields: { key: string; label: string }[]
  ): Record<string, number | null> | null {
    const result: Record<string, number | null> = {};
    for (const field of fields) {
      const raw = source[field.key]?.trim();
      if (!raw) {
        result[field.key] = null;
        continue;
      }
      const parsed = Number(raw);
      if (Number.isNaN(parsed)) {
        setError(`${field.label}: valor inválido.`);
        return null;
      }
      result[field.key] = parsed;
    }
    return result;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const metrics = parseValues(values, BODY_METRIC_FIELDS);
    if (!metrics) return;
    const measurements = parseValues(measurementValues, BODY_MEASUREMENT_FIELDS);
    if (!measurements) return;

    saveMutation.mutate({ measured_at: measuredAt, notes: notes.trim() || null, metrics, measurements });
  }

  const heading = editingReport
    ? `Editar relatório de ${formatShortDate(editingReport.measured_at)}`
    : 'Criar relatório';

  function renderMetricField(field: BodyMetricField) {
    return (
      <label key={field.key} className="report-field">
        <span className="report-field-label">
          {field.label}
          {field.unit && <span className="field-unit">({field.unit})</span>}
        </span>
        <input
          type="number"
          step="0.01"
          value={values[field.key] ?? ''}
          onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
        />
      </label>
    );
  }

  function renderMeasurementField(field: BodyMeasurementField) {
    return (
      <label key={field.key} className="report-field">
        <span className="report-field-label">
          {field.label}
          <span className="field-unit">(cm)</span>
          {field.optional && <span className="field-optional">opcional</span>}
        </span>
        <input
          type="number"
          step="0.1"
          value={measurementValues[field.key] ?? ''}
          onChange={(e) => setMeasurementValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
        />
      </label>
    );
  }

  return (
    <div className="admin-section create-body-report">
      <span className="create-body-report-eyebrow">Composição corporal</span>
      <h2 className="section-title">{heading}</h2>
      <p className="import-hint">
        Preencha manualmente os índices do relatório. Só a data é obrigatória — o resto pode ficar em branco.
      </p>

      <form className="report-form" onSubmit={handleSubmit}>
        <label className="report-date-field">
          <span className="report-field-label">Data da medição</span>
          <input
            type="date"
            value={measuredAt}
            onChange={(e) => setMeasuredAt(e.target.value)}
            disabled={!!editingReport}
            required
          />
          {editingReport && <span className="report-field-hint">A data não pode ser alterada na edição.</span>}
        </label>

        <section className="report-card">
          <div className="report-card-header">
            <Scale size={15} />
            <span>Composição corporal</span>
          </div>
          <div className="report-field-grid">{BODY_METRIC_FIELDS.map(renderMetricField)}</div>
        </section>

        <section className="report-card">
          <div className="report-card-header">
            <Ruler size={15} />
            <span>Medidas perimétricas</span>
          </div>
          <p className="report-card-hint">
            Medidas de fita métrica — cada campo é opcional, preencha só o que tiver medido.
          </p>
          {MEASUREMENT_GROUPS.map((group) => (
            <div key={group} className="report-measurement-group">
              <h4 className="report-group-title">{group}</h4>
              <div className="report-field-grid">
                {BODY_MEASUREMENT_FIELDS.filter((field) => field.group === group).map(renderMeasurementField)}
              </div>
            </div>
          ))}
        </section>

        <section className="report-card">
          <div className="report-card-header">
            <StickyNote size={15} />
            <span>Notas</span>
          </div>
          <label className="report-field report-field-full">
            <span className="report-field-label">Observações (opcional)</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </section>

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
