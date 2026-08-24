import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ArrowLeft, BarChart3, Maximize2, Table2, TrendingUp } from 'lucide-react';
import { EmptyState } from '../../components/EmptyState';
import { fetchExerciseProgress, type ExerciseProgress, type MetricKey } from './api';
import { formatShortDate } from '../../lib/date';
import './dashboard.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip);

const rootStyle = getComputedStyle(document.documentElement);
const cssVar = (name: string, fallback: string) => rootStyle.getPropertyValue(name).trim() || fallback;
const accentColor = cssVar('--accent', '#2f6fed');
const textColor = cssVar('--text', '#9a9c9f');
const gridColor = cssVar('--border', '#3a3d42');

type ViewMode = 'chart' | 'table';

const METRIC_META: Record<MetricKey, { label: string; unit: string; color: string }> = {
  weight: { label: 'Carga máxima', unit: 'kg', color: accentColor },
  duration: { label: 'Duração', unit: 'min', color: cssVar('--metric-duration', '#3987e5') },
  distance: { label: 'Distância', unit: 'km', color: cssVar('--metric-distance', '#d95926') },
  incline: { label: 'Inclinação', unit: '°', color: cssVar('--metric-incline', '#199e70') },
  calories: { label: 'Calorias', unit: 'kcal', color: cssVar('--metric-calories', '#c98500') },
};

// Exercício de força (musculação) segue com Tempo em segundos (isométricos,
// ex.: prancha); só cardio (múltiplas métricas em paralelo) usa Duração em
// minutos — mesma métrica 'duration', unidade diferente por contexto.
function metricLabel(key: MetricKey, isSingleMetric: boolean): string {
  if (key === 'duration' && isSingleMetric) return 'Tempo máximo (s)';
  const meta = METRIC_META[key];
  return `${meta.label} (${meta.unit})`;
}

function metricUnit(key: MetricKey, isSingleMetric: boolean): string {
  if (key === 'duration' && isSingleMetric) return 's';
  return METRIC_META[key].unit;
}

// Card do grid é um <button> (abre o exercício expandido ao clicar) — um
// <select> nativo não pode viver dentro de um <button> (elementos
// interativos não podem se aninhar), então a escolha de métrica só fica
// disponível na versão expandida (interactive=true); no grid mostra sempre
// a primeira métrica, sem seletor.
function ExerciseChart({
  exercise,
  tall,
  interactive,
}: {
  exercise: ExerciseProgress;
  tall?: boolean;
  interactive?: boolean;
}) {
  const isSingleMetric = exercise.metricKeys.length === 1;
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>(exercise.metricKeys[0]);
  const activeMetric = isSingleMetric ? exercise.metricKeys[0] : selectedMetric;
  const canPickMetric = !isSingleMetric && interactive;

  const chartPoints = exercise.points.filter((p) => p.values[activeMetric] != null);
  const best = chartPoints.length > 0 ? Math.max(...chartPoints.map((p) => p.values[activeMetric]!)) : null;

  return (
    <>
      <div className="progress-header">
        <h3>{isSingleMetric ? exercise.exerciseName : `${exercise.exerciseName} — ${METRIC_META[activeMetric].label}`}</h3>
        {canPickMetric ? (
          <select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value as MetricKey)}>
            {exercise.metricKeys.map((key) => (
              <option key={key} value={key}>
                {METRIC_META[key].label}
              </option>
            ))}
          </select>
        ) : (
          best != null && (
            <span className="progress-best">
              {best} {metricUnit(activeMetric, isSingleMetric)}
            </span>
          )
        )}
      </div>
      <div className={tall ? 'progress-chart-tall' : undefined}>
        <Line
          data={{
            labels: chartPoints.map((p) => formatShortDate(p.date)),
            datasets: [
              {
                label: metricLabel(activeMetric, isSingleMetric),
                data: chartPoints.map((p) => p.values[activeMetric] ?? null),
                borderColor: METRIC_META[activeMetric].color,
                backgroundColor: METRIC_META[activeMetric].color,
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
              y: {
                beginAtZero: false,
                ticks: { color: textColor },
                grid: { color: gridColor },
                title: { display: true, text: metricLabel(activeMetric, isSingleMetric), color: textColor },
              },
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

// Exercício de cardio tem 4 métricas em paralelo — não cabe no formato
// linha=exercício/coluna=data (um valor só por célula), então ganha tabela
// própria: colunas fixas por métrica, uma linha por data.
function CardioExerciseTable({ exercise }: { exercise: ExerciseProgress }) {
  return (
    <div className="exercise-table-wrap cardio-table-wrap">
      <p className="cardio-table-title">{exercise.exerciseName}</p>
      <table className="exercise-table">
        <thead>
          <tr>
            <th>Data</th>
            {exercise.metricKeys.map((key) => (
              <th key={key}>{metricLabel(key, false)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {exercise.points.map((point) => (
            <tr key={point.date}>
              <td>{formatShortDate(point.date)}</td>
              {exercise.metricKeys.map((key) => (
                <td key={key}>{point.values[key] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExerciseTable({ exercises }: { exercises: ExerciseProgress[] }) {
  const singleMetricExercises = useMemo(() => exercises.filter((e) => e.metricKeys.length === 1), [exercises]);
  const multiMetricExercises = useMemo(() => exercises.filter((e) => e.metricKeys.length > 1), [exercises]);

  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const exercise of singleMetricExercises) {
      for (const point of exercise.points) set.add(point.date);
    }
    return Array.from(set).sort();
  }, [singleMetricExercises]);

  return (
    <div className="exercise-table-section">
      {singleMetricExercises.length > 0 && (
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
              {singleMetricExercises.map((exercise) => {
                const key = exercise.metricKeys[0];
                const unit = metricUnit(key, true);
                const byDate = new Map(exercise.points.map((p) => [p.date, p.values[key]]));
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
      )}

      {multiMetricExercises.map((exercise) => (
        <CardioExerciseTable key={exercise.exerciseId} exercise={exercise} />
      ))}
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
            <ExerciseChart exercise={expandedExercise} tall interactive />
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
