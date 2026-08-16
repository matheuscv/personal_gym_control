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
import { ArrowDown, ArrowUp, PieChart } from 'lucide-react';
import { EmptyState } from '../../components/EmptyState';
import { fetchBodyProgress, type BodyReportPoint } from './bodyApi';
import { BODY_METRIC_FIELDS, type BodyMetricField } from '../bodyMetricsFields';
import { BODY_MEASUREMENT_FIELDS } from '../bodyMeasurementFields';
import { fetchGoal } from '../goalApi';
import { computeGoalProgress } from '../goalProgress';
import { bodyLevelClass, classifyImc } from '../bodyClassification';
import './dashboard.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

const rootStyle = getComputedStyle(document.documentElement);
const accentColor = rootStyle.getPropertyValue('--accent').trim() || '#2f6fed';
const textColor = rootStyle.getPropertyValue('--text').trim() || '#9a9c9f';
const gridColor = rootStyle.getPropertyValue('--border').trim() || '#3a3d42';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

interface ResumoRow {
  key: string;
  label: string;
  kg: number;
  pct: number | null;
  min?: number;
  max?: number;
  avaliacao?: string;
}

type CompKey = 'peso' | 'massa_gorda' | 'massa_ossea' | 'massa_proteica' | 'agua_corporal' | 'massa_muscular';

function withAnalysis(
  analysis: BodyReportPoint['composition_analysis'],
  key: CompKey,
  row: Omit<ResumoRow, 'min' | 'max' | 'avaliacao'>
): ResumoRow {
  const a = analysis?.[key];
  return { ...row, min: a?.min, max: a?.max, avaliacao: a?.avaliacao };
}

// Vocabulário livre vindo do relatório (Fitdays) — heurística de cor pra
// reaproveitar os mesmos badges usados nos cards de IMC/Gordura corporal.
function avaliacaoClass(label: string): 'ok' | 'accent' | 'danger' | 'neutral' {
  const l = label.toLowerCase();
  if (l.includes('muito alto') || l.includes('muito baixo') || l.includes('obes')) return 'danger';
  if (l.includes('alto') || l.includes('baixo')) return 'accent';
  if (l.includes('excelente') || l.includes('ótimo') || l.includes('bom') || l.includes('padrão') || l.includes('normal'))
    return 'ok';
  return 'neutral';
}

function buildResumo(latest: BodyReportPoint | undefined): ResumoRow[] {
  const peso = latest?.metrics.peso_kg;
  if (peso == null) return [];
  const m = latest!.metrics;
  const analysis = latest!.composition_analysis;
  const rows: ResumoRow[] = [withAnalysis(analysis, 'peso', { key: 'peso', label: 'Peso', kg: peso, pct: 100 })];

  if (m.gordura_corporal_pct != null) {
    rows.push(
      withAnalysis(analysis, 'massa_gorda', {
        key: 'massa_gorda',
        label: 'Massa gorda',
        kg: round1((peso * m.gordura_corporal_pct) / 100),
        pct: m.gordura_corporal_pct,
      })
    );
  }
  if (m.massa_ossea_kg != null) {
    rows.push(
      withAnalysis(analysis, 'massa_ossea', {
        key: 'massa_ossea',
        label: 'Massa óssea',
        kg: m.massa_ossea_kg,
        pct: round1((m.massa_ossea_kg / peso) * 100),
      })
    );
  }
  if (m.proteina_pct != null) {
    rows.push(
      withAnalysis(analysis, 'massa_proteica', {
        key: 'massa_proteica',
        label: 'Massa protéica',
        kg: round1((peso * m.proteina_pct) / 100),
        pct: m.proteina_pct,
      })
    );
  }
  if (m.agua_corporal_pct != null) {
    rows.push(
      withAnalysis(analysis, 'agua_corporal', {
        key: 'agua_corporal',
        label: 'Água corporal',
        kg: round1((peso * m.agua_corporal_pct) / 100),
        pct: m.agua_corporal_pct,
      })
    );
  }
  if (m.massa_muscular_kg != null) {
    rows.push(
      withAnalysis(analysis, 'massa_muscular', {
        key: 'massa_muscular',
        label: 'Massa muscular',
        kg: m.massa_muscular_kg,
        pct: round1((m.massa_muscular_kg / peso) * 100),
      })
    );
  }
  return rows;
}

function trend(current: number | null | undefined, previous: number | null | undefined): 'up' | 'down' | null {
  if (current == null || previous == null || current === previous) return null;
  return current > previous ? 'up' : 'down';
}

// "Idem Peso": reduzir é favorável (seta verde pra baixo). "Idem Massa
// muscular": aumentar é favorável (seta verde pra cima). Peso-alvo não tem
// regra — nunca mostra seta.
const LOWER_IS_BETTER = new Set([
  'peso_kg',
  'imc',
  'gordura_corporal_pct',
  'massa_gorda_kg',
  'gordura_visceral',
  'gordura_subcutanea_pct',
  'smi_kg_m2',
  'idade_corporal',
  'whr',
  'controle_peso_kg',
  'grau_obesidade_pct',
]);
const HIGHER_IS_BETTER = new Set([
  'massa_muscular_kg',
  'massa_ossea_kg',
  'agua_corporal_pct',
  'agua_corporal_kg',
  'proteina_pct',
  'massa_proteica_kg',
  'tmb_kcal',
  'peso_livre_gordura_kg',
  'pontuacao_corporal',
]);

function trendDisplay(
  fieldKey: string,
  current: number | null | undefined,
  previous: number | null | undefined
): { dir: 'up' | 'down'; good: boolean } | null {
  if (!LOWER_IS_BETTER.has(fieldKey) && !HIGHER_IS_BETTER.has(fieldKey)) return null;
  const dir = trend(current, previous);
  if (!dir) return null;
  const good = LOWER_IS_BETTER.has(fieldKey) ? dir === 'down' : dir === 'up';
  return { dir, good };
}

// Delta do valor mais recente contra a medição anterior, pros cards do
// topo (Peso, IMC, Gordura subcutânea, Idade corporal, Pontuação
// corporal) — mesma regra de favorabilidade usada nas setinhas do
// histórico (LOWER_IS_BETTER/HIGHER_IS_BETTER).
function kpiDelta(
  fieldKey: string,
  current: number | null | undefined,
  previous: number | null | undefined
): { delta: number; cls: string } | null {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  const cls =
    delta === 0
      ? 'kpi-delta-neutral'
      : (LOWER_IS_BETTER.has(fieldKey) ? delta < 0 : delta > 0)
        ? 'kpi-delta-good'
        : 'kpi-delta-bad';
  return { delta, cls };
}

function formatDelta(delta: number, decimals: number): string {
  return `${delta > 0 ? '+' : ''}${delta.toFixed(decimals)}`;
}

// Mesma regra do card Peso atual (reduzir é favorável), só que pras
// medidas perimétricas (cm) em vez dos índices de body_metrics.
function measurementKpiDelta(
  current: number | null | undefined,
  previous: number | null | undefined
): { delta: number; cls: string } | null {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  const cls = delta === 0 ? 'kpi-delta-neutral' : delta < 0 ? 'kpi-delta-good' : 'kpi-delta-bad';
  return { delta, cls };
}

// Medidas perimétricas seguem a mesma regra da Gordura corporal: reduzir é
// favorável (seta verde pra baixo), aumentar é desfavorável (vermelha pra
// cima) — vale pra todos os 15 campos, sem distinção por área do corpo.
function measurementTrendDisplay(
  current: number | null | undefined,
  previous: number | null | undefined
): { dir: 'up' | 'down'; good: boolean } | null {
  const dir = trend(current, previous);
  if (!dir) return null;
  return { dir, good: dir === 'down' };
}

// Gordura corporal/Água corporal/Proteína só existem no banco como
// percentual (proporção de peso) — pra sempre exibir o valor bruto medido
// (kg) em vez do percentual, tanto no histórico quanto no seletor do
// gráfico, essas 3 entradas de BODY_METRIC_FIELDS são trocadas pelo
// equivalente em kg (mesma conta do buildResumo), mantendo a posição.
const KG_FIELD_OVERRIDE: Record<string, BodyMetricField> = {
  gordura_corporal_pct: { key: 'massa_gorda_kg', label: 'Massa gorda', unit: 'kg' },
  agua_corporal_pct: { key: 'agua_corporal_kg', label: 'Água corporal', unit: 'kg' },
  proteina_pct: { key: 'massa_proteica_kg', label: 'Massa protéica', unit: 'kg' },
};

const HISTORY_FIELDS: BodyMetricField[] = BODY_METRIC_FIELDS.map((field) => KG_FIELD_OVERRIDE[field.key] ?? field);

export function BodyDashboardPage() {
  const progressQuery = useQuery({ queryKey: ['body-progress'], queryFn: fetchBodyProgress });
  const goalQuery = useQuery({ queryKey: ['user-goal'], queryFn: fetchGoal });
  const [selectedField, setSelectedField] = useState('peso_kg');

  const desiredWeight = goalQuery.data?.desired_weight_kg ?? null;

  // Sempre sobrescreve Peso-alvo/Controle de peso com o objetivo cadastrado
  // em Meu Objetivo, em vez do valor que veio no relatório original — e
  // recalcula o controle em cima desse valor pra cada linha do histórico.
  // Também injeta as séries derivadas em kg (massa gorda, água corporal,
  // massa proteica) pra elas ficarem selecionáveis no gráfico.
  const reportsWithGoalOverride = useMemo(() => {
    const reports = progressQuery.data ?? [];
    return reports.map((r) => {
      const peso = r.metrics.peso_kg;
      return {
        measured_at: r.measured_at,
        composition_analysis: r.composition_analysis,
        measurements: r.measurements,
        metrics: {
          ...r.metrics,
          peso_alvo_kg: desiredWeight,
          controle_peso_kg:
            desiredWeight != null && r.metrics.peso_kg != null ? desiredWeight - r.metrics.peso_kg : null,
          massa_gorda_kg:
            peso != null && r.metrics.gordura_corporal_pct != null
              ? round1((peso * r.metrics.gordura_corporal_pct) / 100)
              : null,
          agua_corporal_kg:
            peso != null && r.metrics.agua_corporal_pct != null
              ? round1((peso * r.metrics.agua_corporal_pct) / 100)
              : null,
          massa_proteica_kg:
            peso != null && r.metrics.proteina_pct != null ? round1((peso * r.metrics.proteina_pct) / 100) : null,
        } as Record<string, number | null>,
      };
    });
  }, [progressQuery.data, desiredWeight]);

  const availableFields = useMemo(() => {
    return HISTORY_FIELDS.filter((field) => reportsWithGoalOverride.some((r) => r.metrics[field.key] != null));
  }, [reportsWithGoalOverride]);

  if (progressQuery.isLoading) {
    return (
      <div className="dashboard-page-wrap">
        <h1>Evolução corporal</h1>
        <p className="workout-status">Carregando evolução...</p>
      </div>
    );
  }

  const reports = reportsWithGoalOverride;
  if (reports.length === 0) {
    return (
      <div className="dashboard-page-wrap">
        <h1>Evolução corporal</h1>
        <EmptyState
          icon={<PieChart size={34} />}
          title="Ainda não há relatórios corporais"
          description="Registre seu primeiro relatório de composição corporal (manual ou por importação de JSON) para acompanhar sua evolução."
          actionLabel="Registrar em Configuração"
          actionTo="/admin/body-report"
        />
      </div>
    );
  }

  const latest = reports[reports.length - 1];
  const first = reports[0];
  const previousReport = reports.length > 1 ? reports[reports.length - 2] : undefined;
  const goalProgress = computeGoalProgress(first.metrics.peso_kg ?? null, latest.metrics.peso_kg ?? null, desiredWeight);

  const imcLevel = latest.metrics.imc != null ? classifyImc(latest.metrics.imc) : null;

  const pesoDelta = kpiDelta('peso_kg', latest.metrics.peso_kg, previousReport?.metrics.peso_kg);
  const imcDelta = kpiDelta('imc', latest.metrics.imc, previousReport?.metrics.imc);
  const subcutaneaDelta = kpiDelta(
    'gordura_subcutanea_pct',
    latest.metrics.gordura_subcutanea_pct,
    previousReport?.metrics.gordura_subcutanea_pct
  );
  const idadeDelta = kpiDelta('idade_corporal', latest.metrics.idade_corporal, previousReport?.metrics.idade_corporal);
  const pontuacaoDelta = kpiDelta(
    'pontuacao_corporal',
    latest.metrics.pontuacao_corporal,
    previousReport?.metrics.pontuacao_corporal
  );
  const cinturaDelta = measurementKpiDelta(latest.measurements.cintura_cm, previousReport?.measurements.cintura_cm);
  const abdomenDelta = measurementKpiDelta(
    latest.measurements.abdomen_quadril_cm,
    previousReport?.measurements.abdomen_quadril_cm
  );

  const resumoRows = buildResumo(latest);

  const activeField = availableFields.find((f) => f.key === selectedField) ?? availableFields[0];
  const chartPoints = activeField ? reports.filter((r) => r.metrics[activeField.key] != null) : [];

  const historyDescending = [...reports].reverse();

  return (
    <div className="dashboard-page-wrap">
      <h1>Evolução corporal</h1>
      <div className="body-dashboard">
        <div className="kpi-row">
          <div className="kpi-card">
            <span className="kpi-label">Peso atual</span>
            <span className="kpi-value">{latest.metrics.peso_kg ?? '—'} kg</span>
            {pesoDelta && <span className={`kpi-delta ${pesoDelta.cls}`}>({formatDelta(pesoDelta.delta, 1)} kg)</span>}
          </div>
          <div className="kpi-card">
            <span className="kpi-label">IMC atual</span>
            <span className="kpi-value">{latest.metrics.imc ?? '—'}</span>
            {imcDelta && <span className={`kpi-delta ${imcDelta.cls}`}>({formatDelta(imcDelta.delta, 1)})</span>}
            {imcLevel && <span className={`kpi-badge kpi-badge-${bodyLevelClass(imcLevel)}`}>{imcLevel}</span>}
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Gordura subcutânea</span>
            <span className="kpi-value">{latest.metrics.gordura_subcutanea_pct ?? '—'} %</span>
            {subcutaneaDelta && (
              <span className={`kpi-delta ${subcutaneaDelta.cls}`}>({formatDelta(subcutaneaDelta.delta, 1)} %)</span>
            )}
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Idade corporal</span>
            <span className="kpi-value">{latest.metrics.idade_corporal ?? '—'} anos</span>
            {idadeDelta && <span className={`kpi-delta ${idadeDelta.cls}`}>({formatDelta(idadeDelta.delta, 0)} anos)</span>}
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Pontuação corporal</span>
            <span className="kpi-value">{latest.metrics.pontuacao_corporal ?? '—'} pts</span>
            {pontuacaoDelta && (
              <span className={`kpi-delta ${pontuacaoDelta.cls}`}>({formatDelta(pontuacaoDelta.delta, 0)} pts)</span>
            )}
          </div>
          <div className="kpi-card kpi-card-goal">
            <span className="kpi-label">Controle de peso</span>
            <div className="kpi-goal-row">
              <span>Peso-alvo</span>
              <strong>{goalProgress.desiredWeight != null ? `${goalProgress.desiredWeight} kg` : '—'}</strong>
            </div>
            <div className="kpi-goal-row">
              <span>Kg pendentes</span>
              <strong>
                {goalProgress.pendingKg != null ? `${Math.abs(goalProgress.pendingKg).toFixed(1)} kg` : '—'}
              </strong>
            </div>
            <div className="kpi-goal-row">
              <span>% pendente</span>
              <strong>{goalProgress.pendingPct != null ? `${goalProgress.pendingPct.toFixed(1)}%` : '—'}</strong>
            </div>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Cintura</span>
            <span className="kpi-value">{latest.measurements.cintura_cm ?? '—'} cm</span>
            {cinturaDelta && (
              <span className={`kpi-delta ${cinturaDelta.cls}`}>({formatDelta(cinturaDelta.delta, 1)} cm)</span>
            )}
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Abdômen/Quadril</span>
            <span className="kpi-value">{latest.measurements.abdomen_quadril_cm ?? '—'} cm</span>
            {abdomenDelta && (
              <span className={`kpi-delta ${abdomenDelta.cls}`}>({formatDelta(abdomenDelta.delta, 1)} cm)</span>
            )}
          </div>
        </div>

        {resumoRows.length > 0 && (
          <div className="progress-card resumo-card">
            <div className="progress-header">
              <h3>Análise da composição corporal</h3>
              <span className="resumo-date">{latest.measured_at}</span>
            </div>
            <div className="resumo-table-wrap">
              <table className="resumo-table">
                <thead>
                  <tr>
                    <th>Métrica</th>
                    <th>Medição (kg)</th>
                    <th>Proporção de peso (%)</th>
                    <th>Avaliação</th>
                  </tr>
                </thead>
                <tbody>
                  {resumoRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td className="resumo-value">
                        {row.kg} kg
                        {row.min != null && row.max != null && (
                          <span className="resumo-range">
                            {' '}
                            ({row.min}-{row.max})
                          </span>
                        )}
                      </td>
                      <td className="resumo-value">{row.pct != null ? `${row.pct}%` : '—'}</td>
                      <td>
                        {row.avaliacao ? (
                          <span className={`kpi-badge kpi-badge-${avaliacaoClass(row.avaliacao)}`}>
                            {row.avaliacao}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeField && (
          <div className="progress-card metric-chart-card">
            <div className="progress-header">
              <h3>Evolução — {activeField.label}</h3>
              <select value={activeField.key} onChange={(e) => setSelectedField(e.target.value)}>
                {availableFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
              </select>
            </div>
            <Line
              data={{
                labels: chartPoints.map((p) => p.measured_at),
                datasets: [
                  {
                    label: activeField.label,
                    data: chartPoints.map((p) => p.metrics[activeField.key]),
                    borderColor: accentColor,
                    backgroundColor: accentColor,
                    tension: 0.25,
                  },
                ],
              }}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { color: textColor }, grid: { color: gridColor } },
                  y: { beginAtZero: false, ticks: { color: textColor }, grid: { color: gridColor } },
                },
              }}
            />
          </div>
        )}

        <h2 className="section-title">Histórico</h2>
        <div className="body-history-scroll">
          <table className="body-history-table">
            <thead>
              <tr>
                <th>Data</th>
                {HISTORY_FIELDS.map((field) => (
                  <th key={field.key}>{field.label}</th>
                ))}
                {BODY_MEASUREMENT_FIELDS.map((field) => (
                  <th key={field.key}>{field.label} (cm)</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historyDescending.map((report, index) => {
                const previous = historyDescending[index + 1];
                return (
                  <tr key={report.measured_at}>
                    <td>{report.measured_at}</td>
                    {HISTORY_FIELDS.map((field) => {
                      const value = report.metrics[field.key];
                      const displayValue =
                        field.key === 'controle_peso_kg' && value != null ? value.toFixed(2) : value ?? '—';
                      const trendResult = trendDisplay(field.key, value, previous?.metrics[field.key]);
                      return (
                        <td key={field.key}>
                          {displayValue}
                          {trendResult &&
                            (trendResult.dir === 'up' ? (
                              <ArrowUp className={trendResult.good ? 'trend-good' : 'trend-bad'} size={12} />
                            ) : (
                              <ArrowDown className={trendResult.good ? 'trend-good' : 'trend-bad'} size={12} />
                            ))}
                        </td>
                      );
                    })}
                    {BODY_MEASUREMENT_FIELDS.map((field) => {
                      const value = report.measurements[field.key];
                      const trendResult = measurementTrendDisplay(value, previous?.measurements[field.key]);
                      return (
                        <td key={field.key}>
                          {value ?? '—'}
                          {trendResult &&
                            (trendResult.dir === 'up' ? (
                              <ArrowUp className={trendResult.good ? 'trend-good' : 'trend-bad'} size={12} />
                            ) : (
                              <ArrowDown className={trendResult.good ? 'trend-good' : 'trend-bad'} size={12} />
                            ))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
