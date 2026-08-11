import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { bodyReportSchema } from '../../../api/_lib/importBodyReportSchema';

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

export function ImportBodyReportPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleImport() {
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

    setSubmitting(true);
    try {
      const response = await fetch('/api/import-body-report', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(parsed.data),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? 'Falha ao importar.');
        return;
      }
      setSuccess(`Relatório de ${body.measured_at} importado.`);
      setText('');
      queryClient.invalidateQueries({ queryKey: ['admin-body-reports'] });
      queryClient.invalidateQueries({ queryKey: ['body-progress'] });
    } catch {
      setError('Falha de rede ao importar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-section">
      <h2 className="section-title">Importar relatório corporal (JSON)</h2>
      <p className="import-hint">
        Cole aqui o JSON com os índices extraídos pelo Claude a partir da foto do relatório de bioimpedância.
        Apenas <code>measured_at</code> é obrigatório — os demais campos podem ser omitidos. Reimportar um
        relatório com a mesma data substitui os valores existentes.
      </p>

      <textarea
        className="import-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={EXAMPLE}
        rows={14}
      />

      {error && <p className="admin-error">{error}</p>}
      {success && <p className="import-success">{success}</p>}

      <button type="button" onClick={handleImport} disabled={submitting || !text.trim()}>
        {submitting ? 'Importando...' : 'Importar'}
      </button>
    </div>
  );
}
