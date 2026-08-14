import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, Save, PencilLine, X } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../auth/auth-context';
import { bodyReportSchema, type BodyReportInput } from '../../../api/_lib/importBodyReportSchema';
import { BODY_METRIC_FIELDS } from '../bodyMetricsFields';
import './ImportPreview.css';
import './ImportBodyReportPage.css';

const EXAMPLE = `{
  "measured_at": "2026-08-11",
  "peso_kg": 78.4,
  "imc": 24.1,
  "gordura_corporal_pct": 18.2,
  "massa_muscular_kg": 34.6,
  "massa_ossea_kg": 3.1,
  "agua_corporal_pct": 55.3,
  "gordura_visceral": 7,
  "tmb_kcal": 1720
}`;

function formatMeasuredAt(dateStr: string): string {
  try {
    return format(new Date(`${dateStr}T00:00:00`), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
}

export function ImportBodyReportPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const [text, setText] = useState('');
  const [preview, setPreview] = useState<BodyReportInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleTextChange(value: string) {
    setText(value);
    if (preview) setPreview(null);
    if (error) setError(null);
  }

  function handlePreview() {
    setError(null);
    setSuccess(null);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      setError('JSON inválido: verifique a sintaxe.');
      return;
    }

    const parsed = bodyReportSchema.safeParse(parsedJson);
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
      return;
    }

    setPreview(parsed.data);
  }

  function handleCancel() {
    setText('');
    setPreview(null);
    setError(null);
  }

  async function handleSave() {
    if (!preview) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const response = await fetch('/api/import-body-report', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(preview),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? 'Falha ao importar.');
        return;
      }
      setSuccess(`Relatório de ${formatMeasuredAt(body.measured_at)} salvo.`);
      setText('');
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ['admin-body-reports'] });
      queryClient.invalidateQueries({ queryKey: ['body-progress'] });
    } catch {
      setError('Falha de rede ao importar.');
    } finally {
      setSubmitting(false);
    }
  }

  const filledMetrics = preview
    ? BODY_METRIC_FIELDS.map((field) => ({
        ...field,
        value: (preview as unknown as Record<string, number | null | undefined>)[field.key],
      })).filter((field): field is typeof field & { value: number } => typeof field.value === 'number')
    : [];

  return (
    <div className="admin-section import-body-report">
      <span className="import-body-report-eyebrow">Colar JSON</span>
      <h2 className="section-title">Importar relatório corporal</h2>
      <p className="import-hint">
        Cole aqui o JSON com os índices extraídos pelo Claude a partir da foto do relatório de bioimpedância,
        pré-visualize e só depois salve. Apenas <code>measured_at</code> é obrigatório. Reimportar um relatório
        com a mesma data substitui os valores existentes.
      </p>

      <textarea
        className="import-textarea"
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder={EXAMPLE}
        rows={14}
        disabled={submitting}
      />

      {error && <p className="admin-error">{error}</p>}

      {!preview && (
        <button type="button" className="btn-primary" onClick={handlePreview} disabled={!text.trim()}>
          <Eye size={16} />
          Pré-visualizar
        </button>
      )}

      {preview && !success && (
        <div className="import-preview">
          <span className="import-preview-eyebrow">Prévia</span>
          <h3 className="import-preview-name">{formatMeasuredAt(preview.measured_at)}</h3>
          {preview.notes && <p className="import-preview-notes">{preview.notes}</p>}

          {filledMetrics.length > 0 ? (
            <ul className="import-preview-list">
              {filledMetrics.map((field) => (
                <li key={field.key} className="import-preview-item">
                  <span className="import-preview-item-name">{field.label}</span>
                  <span className="import-preview-item-target">
                    {field.value}
                    {field.unit ? ` ${field.unit}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="import-hint">Nenhum índice preenchido além da data.</p>
          )}

          <div className="import-preview-actions">
            <button type="button" className="btn-ghost" onClick={handleCancel}>
              <X size={15} />
              Cancelar
            </button>
            <button type="button" className="btn-ghost" onClick={() => setPreview(null)}>
              <PencilLine size={15} />
              Editar JSON
            </button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={submitting}>
              <Save size={16} />
              {submitting ? 'Salvando...' : 'Salvar relatório'}
            </button>
          </div>
        </div>
      )}

      {success && <p className="import-success">{success}</p>}
    </div>
  );
}
