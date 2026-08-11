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

const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2f6fed';

export function DashboardPage() {
  const progressQuery = useQuery({ queryKey: ['exercise-progress'], queryFn: fetchExerciseProgress });

  if (progressQuery.isLoading) {
    return <p className="workout-status">Carregando evolução...</p>;
  }

  if (!progressQuery.data || progressQuery.data.length === 0) {
    return (
      <div className="dashboard-page empty">
        <p>Ainda não há séries concluídas com peso registrado.</p>
        <p>Preencha e marque como concluídas as séries na tela de treino do dia para ver sua evolução aqui.</p>
      </div>
    );
  }

  return (
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
                scales: { y: { beginAtZero: false } },
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
