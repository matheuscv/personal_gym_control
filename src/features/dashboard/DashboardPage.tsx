import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ArrowLeft, BarChart3, Maximize2, Table2, TrendingUp } from 'lucide-react';
import { EmptyState } from '../../components/EmptyState';
import { fetchExerciseProgress, type ExerciseProgress } from './api';
import { formatShortDate } from '../../lib/date';
import './dashboard.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

const rootStyle = getComputedStyle(document.documentElement);
const accentColor = rootStyle.getPropertyValue('--accent').trim() || '#2f6fed';
const textColor = rootStyle.getPropertyValue('--text').trim() || '#9a9c9f';
const gridColor = rootStyle.getPropertyValue('--border').trim() || '#3a3d42';

type ViewMode = 'chart' | 'table';

function metricInfo(exercise: ExerciseProgress): { unit: string; label: string } {
  const isDuration = exercise.metric === 'duration';
  return {
    unit: isDuration ? 's' : 'kg',
    label: isDuration ? 'Tempo máximo (s)' : 'Carga máxima (kg)',
  };
}

function ExerciseChart({ exercise, tall }: { exercise: ExerciseProgress; tall?: boolean }) {
  const { unit, label } = metricInfo(exercise);
  const best = Math.max(...exercise.points.map((p) => p.value));

  return (
    <>
      <div className="progress-header">
        <h3>{exercise.exerciseName}</h3>
        <span className="progress-best">
          {best} {unit}
        </span>
      </div>
      <div className={tall ? 'progress-chart-tall' : undefined}>
        <Line
          data={{
            labels: exercise.points.map((p) => formatShortDate(p.date)),
            datasets: [
              {
                label,
                data: exercise.points.map((p) => p.value),
                borderColor: accentColor,
                backgroundColor: accentColor,
                tension: 0.25,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: !tall,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: textColor }, grid: { color: gridColor } },
              y: { beginAtZero: false, ticks: { color: textColor }, grid: { color: gridColor } },
            },
          }}
        />
      </div>
    </>
  );
}

interface ExerciseGroup {
  planName: string;
  exercises: ExerciseProgress[];
}

const NO_PLAN_LABEL = 'Sem plano';

// Agrupa por Nome do Treino (plano), ordem alfabética crescente — tanto
// pra tabela quanto pro grid de gráficos. Exercícios fora de qualquer
// plano atual (removidos depois) caem num grupo à parte no fim, depois
// dos grupos nomeados.
function groupByPlan(exercises: ExerciseProgress[]): ExerciseGroup[] {
  const byPlan = new Map<string, ExerciseProgress[]>();
  for (const exercise of exercises) {
    const key = exercise.planName ?? NO_PLAN_LABEL;
    const list = byPlan.get(key) ?? [];
    list.push(exercise);
    byPlan.set(key, list);
  }

  const sortByName = (list: ExerciseProgress[]) =>
    [...list].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName, 'pt-BR'));

  const named = Array.from(byPlan.entries())
    .filter(([planName]) => planName !== NO_PLAN_LABEL)
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([planName, list]) => ({ planName, exercises: sortByName(list) }));

  const unnamed = byPlan.get(NO_PLAN_LABEL);
  return unnamed ? [...named, { planName: NO_PLAN_LABEL, exercises: sortByName(unnamed) }] : named;
}

function ExerciseTable({ exercises }: { exercises: ExerciseProgress[] }) {
  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const exercise of exercises) {
      for (const point of exercise.points) set.add(point.date);
    }
    return Array.from(set).sort();
  }, [exercises]);

  return (
    <div className="exercise-table-wrap">
      <table className="exercise-table">
        <thead>
          <tr>
            <th>Exercício</th>
            {dates.map((date) => (
              <th key={date}>{formatShortDate(date)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {exercises.map((exercise) => {
            const { unit } = metricInfo(exercise);
            const byDate = new Map(exercise.points.map((p) => [p.date, p.value]));
            return (
              <tr key={exercise.exerciseId}>
                <td>
                  {exercise.exerciseName} <span className="table-row-unit">({unit})</span>
                </td>
                {dates.map((date) => (
                  <td key={date}>{byDate.get(date) ?? '—'}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardPage() {
  const progressQuery = useQuery({ queryKey: ['exercise-progress'], queryFn: fetchExerciseProgress });
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  function switchMode(mode: ViewMode) {
    setViewMode(mode);
    setExpandedId(null);
  }

  if (progressQuery.isLoading) {
    return (
      <div className="dashboard-page-wrap">
        <h1>Evolução do treino</h1>
        <p className="workout-status">Carregando evolução...</p>
      </div>
    );
  }

  if (!progressQuery.data || progressQuery.data.length === 0) {
    return (
      <div className="dashboard-page-wrap">
        <h1>Evolução do treino</h1>
        <EmptyState
          icon={<TrendingUp size={34} />}
          title="Sua evolução vai aparecer aqui"
          description="Marque suas séries como concluídas na tela de treino do dia para começar a acompanhar sua carga ao longo do tempo."
          actionLabel="Ir para Treino do dia"
          actionTo="/treino"
        />
      </div>
    );
  }

  const expandedExercise = progressQuery.data.find((exercise) => exercise.exerciseId === expandedId) ?? null;
  const groups = groupByPlan(progressQuery.data);

  return (
    <div className="dashboard-page-wrap">
      <div className="dashboard-view-header">
        <h1>Evolução do treino</h1>
        <div className="view-toggle">
          <button
            type="button"
            className={viewMode === 'chart' ? 'active' : ''}
            onClick={() => switchMode('chart')}
          >
            <BarChart3 size={14} />
            Gráfico
          </button>
          <button
            type="button"
            className={viewMode === 'table' ? 'active' : ''}
            onClick={() => switchMode('table')}
          >
            <Table2 size={14} />
            Tabela
          </button>
        </div>
      </div>

      {viewMode === 'table' && (
        <div className="exercise-groups">
          {groups.map((group) => (
            <section key={group.planName} className="exercise-group">
              <h2 className="exercise-group-title">
                {group.planName}
                <span className="exercise-group-count">{group.exercises.length}</span>
              </h2>
              <ExerciseTable exercises={group.exercises} />
            </section>
          ))}
        </div>
      )}

      {viewMode === 'chart' &&
        (expandedExercise ? (
          <div className="progress-card progress-card-expanded">
            <button type="button" className="back-to-grid-btn" onClick={() => setExpandedId(null)}>
              <ArrowLeft size={15} />
              Voltar
            </button>
            <ExerciseChart exercise={expandedExercise} tall />
          </div>
        ) : (
          <div className="exercise-groups">
            {groups.map((group) => (
              <section key={group.planName} className="exercise-group">
                <h2 className="exercise-group-title">
                  {group.planName}
                  <span className="exercise-group-count">{group.exercises.length}</span>
                </h2>
                <div className="dashboard-page">
                  {group.exercises.map((exercise) => (
                    <button
                      key={exercise.exerciseId}
                      type="button"
                      className="progress-card progress-card-btn"
                      onClick={() => setExpandedId(exercise.exerciseId)}
                    >
                      <ExerciseChart exercise={exercise} />
                      <span className="progress-expand-hint">
                        <Maximize2 size={11} />
                        Ampliar
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ))}
    </div>
  );
}
