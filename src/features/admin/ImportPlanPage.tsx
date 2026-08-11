import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { importPlanSchema } from '../../../api/_lib/importSchema';

const EXAMPLE = `{
  "name": "Treino A",
  "exercises": [
    { "name": "Supino reto", "muscle_group": "Peito", "target_sets": 3, "target_reps": "8-12" },
    { "name": "Agachamento", "muscle_group": "Pernas", "target_sets": 4, "target_reps": "10-15" }
  ]
}`;

export function ImportPlanPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

    const parsed = importPlanSchema.safeParse(parsedJson);
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/import-workout-plan', {
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
      setSuccess(`Plano "${body.plan_name}" importado com ${body.exercises_count} exercício(s).`);
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      queryClient.invalidateQueries({ queryKey: ['admin-exercises'] });
      queryClient.invalidateQueries({ queryKey: ['active-plans'] });
      setTimeout(() => navigate(`/admin/plans/${body.plan_id}`), 1200);
    } catch {
      setError('Falha de rede ao importar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-section">
      <h2 className="section-title">Importar plano (JSON)</h2>
      <p className="import-hint">
        Cole aqui o JSON gerado pelo Claude com o nome do plano e a lista de exercícios. Reimportar um plano
        com o mesmo nome substitui os exercícios existentes.
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
