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
import { fetchBodyProgress } from './bodyApi';
import { BODY_METRIC_FIELDS } from '../bodyMetricsFields';
import './dashboard.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

const rootStyle = getComputedStyle(document.documentElement);
const accentColor = rootStyle.getPropertyValue('--accent').trim() || '#2f6fed';
const textColor = rootStyle.getPropertyValue('--text').trim() || '#9a9c9f';
const gridColor = rootStyle.getPropertyValue('--border').trim() || '#3a3d42';

export function BodyDashboardPage() {
  const progressQuery = useQuery({ queryKey: ['body-progress'], queryFn: fetchBodyProgress });
  const [selectedField, setSelectedField] = useState('peso_kg');

  const availableFields = useMemo(() => {
    const reports = progressQuery.data ?? [];
    return BODY_METRIC_FIELDS.filter((field) => reports.some((r) => r.metrics[field.key] != null));
  }, [progressQuery.data]);

  if (progressQuery.isLoading) {
    return (
      <div className="dashboard-page-wrap">
        <h1>Evolução corporal</h1>
        <p className="workout-status">Carregando evolução...</p>
      </div>
    );
  }

  const reports = progressQuery.data ?? [];
  if (reports.length === 0) {
    return (
      <div className="dashboard-page-wrap">
        <h1>Evolução corporal</h1>
        <div className="dashboard-page empty">
          <p>Ainda não há relatórios de composição corporal registrados.</p>
          <p>Registre um relatório na tela Admin (manual ou via importação de JSON) para ver sua evolução aqui.</p>
        </div>
      </div>
    );
  }

  const latest = reports[reports.length - 1];
  const first = reports[0];
  const weightDelta =
    latest.metrics.peso_kg != null && first.metrics.peso_kg != null
      ? Math.round((latest.metrics.peso_kg - first.metrics.peso_kg) * 100) / 100
      : null;

  const activeField = availableFields.find((f) => f.key === selectedField) ?? availableFields[0];
  const chartPoints = activeField
    ? reports.filter((r) => r.metrics[activeField.key] != null)
    : [];

  return (
    <div className="dashboard-page-wrap">
      <h1>Evolução corporal</h1>
      <div className="body-dashboard">
      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-label">Peso atual</span>
          <span className="kpi-value">{latest.metrics.peso_kg ?? '—'} kg</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">IMC atual</span>
          <span className="kpi-value">{latest.metrics.imc ?? '—'}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Gordura corporal</span>
          <span className="kpi-value">{latest.metrics.gordura_corporal_pct ?? '—'} %</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Variação de peso</span>
          <span className="kpi-value">
            {weightDelta == null ? '—' : `${weightDelta > 0 ? '+' : ''}${weightDelta} kg`}
          </span>
        </div>
      </div>

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
              {BODY_METRIC_FIELDS.map((field) => (
                <th key={field.key}>{field.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...reports].reverse().map((report) => (
              <tr key={report.measured_at}>
                <td>{report.measured_at}</td>
                {BODY_METRIC_FIELDS.map((field) => (
                  <td key={field.key}>{report.metrics[field.key] ?? '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
