import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInYears, format } from 'date-fns';
import {
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { PencilLine, Save, Target, TrendingDown } from 'lucide-react';
import { fetchGoal, upsertGoal } from '../goalApi';
import { computeGoalProgress } from '../goalProgress';
import { fetchBodyReports } from './bodyReportApi';
import './MyGoalPage.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

const rootStyle = getComputedStyle(document.documentElement);
const accentColor = rootStyle.getPropertyValue('--accent').trim() || '#d9a441';
const textColor = rootStyle.getPropertyValue('--text').trim() || '#9a9c9f';
const gridColor = rootStyle.getPropertyValue('--border').trim() || '#3a3d42';

function formatDate(dateStr: string): string {
  return format(new Date(`${dateStr}T00:00:00`), 'dd/MM');
}

export function MyGoalPage() {
  const queryClient = useQueryClient();
  const goalQuery = useQuery({ queryKey: ['user-goal'], queryFn: fetchGoal });
  const reportsQuery = useQuery({ queryKey: ['admin-body-reports'], queryFn: fetchBodyReports });

  const [birthDate, setBirthDate] = useState('');
  const [desiredWeight, setDesiredWeight] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Só sincroniza o form com o servidor UMA vez, na primeira vez que os
  // dados chegam — usa ref (não state) de propósito, pra garantir que um
  // refetch em segundo plano (ex: invalidateQueries do próprio save) nunca
  // reexecute isso e derrube o modo de edição que o usuário escolheu.
  const didInitRef = useRef(false);

  useEffect(() => {
    if (goalQuery.isSuccess && !didInitRef.current) {
      didInitRef.current = true;
      const hasGoal = !!(goalQuery.data?.birth_date || goalQuery.data?.desired_weight_kg != null);
      setBirthDate(goalQuery.data?.birth_date ?? '');
      setDesiredWeight(goalQuery.data?.desired_weight_kg != null ? String(goalQuery.data.desired_weight_kg) : '');
      setIsEditing(!hasGoal);
    }
  }, [goalQuery.isSuccess, goalQuery.data]);

  // O botão "Salvar objetivo" aparece exatamente onde "Editar Meu
  // Objetivo" estava. Em telas touch, o navegador dispara um clique
  // sintético atrasado (~300ms, "ghost click") pra manter compatibilidade
  // com quem ainda espera eventos de mouse — esse clique fantasma acaba
  // caindo no botão novo e submetendo o form sem o usuário perceber.
  // Ignora qualquer submit que aconteça logo após entrar no modo edição.
  const editModeEnteredAtRef = useRef(0);

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

  const { pendingKg, pendingPct } = computeGoalProgress(initialWeight, currentWeight, desiredWeightNum);
  const totalJourneyKg =
    initialWeight != null && desiredWeightNum != null ? initialWeight - desiredWeightNum : null;

  // O gráfico precisa de ordem cronológica (mais antigo → mais recente,
  // esquerda pra direita). A lista abaixo dele é só leitura tabular, onde
  // faz mais sentido mostrar a medição mais recente primeiro.
  const chartPoints = useMemo(() => {
    const ascending = [...reportsWithWeight].reverse();
    return ascending.map((r) => {
      const kgLost = initialWeight != null ? initialWeight - (r.metrics.peso_kg ?? 0) : null;
      const pct = kgLost != null && totalJourneyKg ? (kgLost / totalJourneyKg) * 100 : null;
      return { measured_at: r.measured_at, peso_kg: r.metrics.peso_kg as number, kgLost, pct };
    });
  }, [reportsWithWeight, initialWeight, totalJourneyKg]);

  const chartPointsDescending = useMemo(() => [...chartPoints].reverse(), [chartPoints]);

  const canSave = birthDate.trim() !== '' && desiredWeight.trim() !== '';

  const saveMutation = useMutation({
    mutationFn: upsertGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-goal'] });
      setIsEditing(false);
    },
    onError: (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('Falha ao salvar objetivo:', err);
      const message = err instanceof Error ? err.message : JSON.stringify(err);
      setError(message || 'Falha ao salvar objetivo. Tente novamente.');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (Date.now() - editModeEnteredAtRef.current < 400) return;
    setError(null);
    saveMutation.mutate({
      birth_date: birthDate || null,
      desired_weight_kg: desiredWeightNum,
    });
  }

  function handleEditClick() {
    editModeEnteredAtRef.current = Date.now();
    setIsEditing(true);
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
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            disabled={!isEditing}
          />
        </label>
        {age != null && (
          <p className="my-goal-age">
            Idade: <strong>{age} anos</strong>
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
            disabled={!isEditing}
          />
        </label>

        {error && <p className="admin-error">{error}</p>}

        {isEditing ? (
          <button type="submit" className="btn-primary" disabled={saveMutation.isPending || !canSave}>
            <Save size={16} />
            {saveMutation.isPending ? 'Salvando...' : 'Salvar objetivo'}
          </button>
        ) : (
          <button type="button" className="my-goal-edit-btn" onClick={handleEditClick}>
            <PencilLine size={13} />
            Editar Meu Objetivo
          </button>
        )}
      </form>

      <div className="my-goal-panels">
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
              <span>Peso desejado</span>
              <strong>{desiredWeightNum != null ? `${desiredWeightNum} kg` : '—'}</strong>
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
            <p className="import-hint">
              Cadastre um relatório corporal em "Meus Relatórios" pra calcular o peso atual.
            </p>
          )}
        </div>

        <div className="my-goal-chart">
          <div className="my-goal-info-header">
            <TrendingDown size={15} />
            <span>Evolução da perda de peso</span>
          </div>
          {chartPoints.length > 0 ? (
            <>
              <Line
                data={{
                  labels: chartPoints.map((p) => formatDate(p.measured_at)),
                  datasets: [
                    {
                      label: 'Peso',
                      data: chartPoints.map((p) => p.peso_kg),
                      borderColor: accentColor,
                      backgroundColor: accentColor,
                      tension: 0.25,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => {
                          const point = chartPoints[ctx.dataIndex];
                          const pctLabel = point.pct != null ? ` (${point.pct.toFixed(1)}%)` : '';
                          return `${point.peso_kg} kg${pctLabel}`;
                        },
                      },
                    },
                  },
                  scales: {
                    x: { ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor }, grid: { color: gridColor } },
                  },
                }}
              />
              <ul className="my-goal-chart-list">
                {chartPointsDescending.map((p) => (
                  <li key={p.measured_at}>
                    <span>{formatDate(p.measured_at)}</span>
                    <strong>
                      {p.kgLost != null ? p.kgLost.toFixed(1) : '—'} kg
                      {p.pct != null ? ` (${p.pct.toFixed(1)}%)` : ''}
                    </strong>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="import-hint">Cadastre ao menos um relatório corporal pra ver a evolução aqui.</p>
          )}
        </div>
      </div>
    </div>
  );
}
