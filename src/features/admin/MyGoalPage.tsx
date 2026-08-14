import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInYears } from 'date-fns';
import { Save, Target } from 'lucide-react';
import { fetchGoal, upsertGoal } from './goalApi';
import { fetchBodyReports } from './bodyReportApi';
import './MyGoalPage.css';

export function MyGoalPage() {
  const queryClient = useQueryClient();
  const goalQuery = useQuery({ queryKey: ['user-goal'], queryFn: fetchGoal });
  const reportsQuery = useQuery({ queryKey: ['admin-body-reports'], queryFn: fetchBodyReports });

  const [birthDate, setBirthDate] = useState('');
  const [desiredWeight, setDesiredWeight] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (goalQuery.data && !loaded) {
      setBirthDate(goalQuery.data.birth_date ?? '');
      setDesiredWeight(goalQuery.data.desired_weight_kg != null ? String(goalQuery.data.desired_weight_kg) : '');
      setLoaded(true);
    }
  }, [goalQuery.data, loaded]);

  const age = useMemo(() => {
    if (!birthDate) return null;
    try {
      return differenceInYears(new Date(), new Date(`${birthDate}T00:00:00`));
    } catch {
      return null;
    }
  }, [birthDate]);

  // reportsQuery já vem ordenado por measured_at desc — o primeiro com peso
  // registrado é o peso atual, o último é o peso inicial (ponto de partida
  // fixo da jornada, não muda conforme novos relatórios entram).
  const reportsWithWeight = (reportsQuery.data ?? []).filter((r) => r.metrics.peso_kg != null);
  const currentWeight = reportsWithWeight[0]?.metrics.peso_kg ?? null;
  const initialWeight = reportsWithWeight[reportsWithWeight.length - 1]?.metrics.peso_kg ?? null;
  const desiredWeightNum = desiredWeight.trim() ? Number(desiredWeight) : null;

  const pendingKg =
    currentWeight != null && desiredWeightNum != null ? currentWeight - desiredWeightNum : null;
  const totalJourneyKg =
    initialWeight != null && desiredWeightNum != null ? initialWeight - desiredWeightNum : null;
  const pendingPct =
    pendingKg != null && totalJourneyKg
      ? (Math.abs(pendingKg) / Math.abs(totalJourneyKg)) * 100
      : null;

  const saveMutation = useMutation({
    mutationFn: upsertGoal,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-goal'] }),
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    saveMutation.mutate({
      birth_date: birthDate || null,
      desired_weight_kg: desiredWeightNum,
    });
  }

  return (
    <div className="admin-section my-goal-page">
      <span className="my-goal-eyebrow">Sua meta</span>
      <h2 className="section-title">Meu Objetivo</h2>
      <p className="import-hint">
        Defina sua data de nascimento e o peso desejado — usamos o relatório corporal mais antigo como ponto de
        partida e o mais recente como peso atual pra calcular quanto falta até chegar lá.
      </p>

      <form className="body-report-form my-goal-form" onSubmit={handleSubmit}>
        <label>
          Data de nascimento
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </label>
        {age != null && (
          <p className="my-goal-age">
            Idade: <strong>{age}</strong>
          </p>
        )}

        <label>
          Peso desejado (kg)
          <input
            type="number"
            step="0.1"
            min="0"
            value={desiredWeight}
            onChange={(e) => setDesiredWeight(e.target.value)}
          />
        </label>

        {error && <p className="admin-error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={saveMutation.isPending}>
          <Save size={16} />
          {saveMutation.isPending ? 'Salvando...' : 'Salvar objetivo'}
        </button>
      </form>

      <div className="my-goal-info">
        <div className="my-goal-info-header">
          <Target size={15} />
          <span>Informações importantes</span>
        </div>
        <ul className="my-goal-info-list">
          <li>
            <span>Peso inicial</span>
            <strong>{initialWeight != null ? `${initialWeight} kg` : '—'}</strong>
          </li>
          <li>
            <span>Peso atual</span>
            <strong>{currentWeight != null ? `${currentWeight} kg` : '—'}</strong>
          </li>
          <li>
            <span>Kg pendentes</span>
            <strong>{pendingKg != null ? `${Math.abs(pendingKg).toFixed(1)} kg` : '—'}</strong>
          </li>
          <li>
            <span>Percentual pendente</span>
            <strong>{pendingPct != null ? `${pendingPct.toFixed(1)}%` : '—'}</strong>
          </li>
        </ul>
        {currentWeight == null && (
          <p className="import-hint">Cadastre um relatório corporal em "Relatórios" pra calcular o peso atual.</p>
        )}
      </div>
    </div>
  );
}
