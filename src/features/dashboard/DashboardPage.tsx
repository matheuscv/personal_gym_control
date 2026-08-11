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
import { fetchExerciseProgress } from './api';
import './dashboard.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

const rootStyle = getComputedStyle(document.documentElement);
const accentColor = rootStyle.getPropertyValue('--accent').trim() || '#2f6fed';
const textColor = rootStyle.getPropertyValue('--text').trim() || '#9a9c9f';
const gridColor = rootStyle.getPropertyValue('--border').trim() || '#3a3d42';

export function DashboardPage() {
  const progressQuery = useQuery({ queryKey: ['exercise-progress'], queryFn: fetchExerciseProgress });

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
        <div className="dashboard-page empty">
          <p>Ainda não há séries concluídas com peso registrado.</p>
          <p>Preencha e marque como concluídas as séries na tela de treino do dia para ver sua evolução aqui.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page-wrap">
      <h1>Evolução do treino</h1>
      <div className="dashboard-page">
        {progressQuery.data.map((exercise) => {
          const best = Math.max(...exercise.points.map((p) => p.maxWeight));
          return (
            <div key={exercise.exerciseId} className="progress-card">
              <div className="progress-header">
                <h3>{exercise.exerciseName}</h3>
                <span className="progress-best">{best} kg</span>
              </div>
              <Line
                data={{
                  labels: exercise.points.map((p) => p.date),
                  datasets: [
                    {
                      label: 'Carga máxima (kg)',
                      data: exercise.points.map((p) => p.maxWeight),
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
          );
        })}
      </div>
    </div>
  );
}
