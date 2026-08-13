import { CalendarDays } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPlans } from './api';
import { clearScheduleDay, fetchWeeklySchedule, setScheduleDay } from './scheduleApi';
import './MySchedulePage.css';

const DAYS = [
  { value: 1, label: 'Segunda-feira', short: 'SEG' },
  { value: 2, label: 'Terça-feira', short: 'TER' },
  { value: 3, label: 'Quarta-feira', short: 'QUA' },
  { value: 4, label: 'Quinta-feira', short: 'QUI' },
  { value: 5, label: 'Sexta-feira', short: 'SEX' },
  { value: 6, label: 'Sábado', short: 'SÁB' },
  { value: 0, label: 'Domingo', short: 'DOM' },
];

export function MySchedulePage() {
  const queryClient = useQueryClient();
  const today = new Date().getDay();

  const plansQuery = useQuery({ queryKey: ['admin-plans'], queryFn: fetchPlans });
  const scheduleQuery = useQuery({ queryKey: ['admin-schedule'], queryFn: fetchWeeklySchedule });

  const scheduleByDay = new Map((scheduleQuery.data ?? []).map((row) => [row.day_of_week, row]));
  const trainingDaysCount = scheduleQuery.data?.length ?? 0;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin-schedule'] });
    queryClient.invalidateQueries({ queryKey: ['today-scheduled-plan'] });
  }

  async function handleChange(dayOfWeek: number, value: string) {
    if (value === '') {
      await clearScheduleDay(dayOfWeek);
    } else {
      await setScheduleDay(dayOfWeek, Number(value));
    }
    invalidate();
  }

  return (
    <div className="admin-section schedule-page">
      <span className="schedule-eyebrow">Agenda semanal</span>
      <h2 className="section-title">Meu treino</h2>
      <p className="import-hint">
        Escolha qual plano treinar em cada dia da semana. Dias sem plano selecionado ficam livres — a tela
        "Treino do dia" só mostra algo nos dias configurados aqui.
      </p>

      {!scheduleQuery.isLoading && (
        <p className="schedule-summary">
          <CalendarDays size={14} />
          {trainingDaysCount === 0
            ? 'Nenhum dia configurado ainda'
            : `${trainingDaysCount} dia${trainingDaysCount > 1 ? 's' : ''} de treino por semana`}
        </p>
      )}

      <ul className="schedule-list">
        {DAYS.map((day) => {
          const scheduled = scheduleByDay.get(day.value);
          const isToday = day.value === today;
          return (
            <li key={day.value} className={`schedule-day ${isToday ? 'is-today' : ''}`}>
              <div className="schedule-day-label">
                <span className="schedule-day-chip">{day.short}</span>
                <div className="schedule-day-text">
                  <span className="schedule-day-name">{day.label}</span>
                  {isToday && <span className="schedule-day-badge">Hoje</span>}
                </div>
              </div>
              <select
                value={scheduled?.plan_id ?? ''}
                onChange={(e) => handleChange(day.value, e.target.value)}
                disabled={plansQuery.isLoading}
                className={scheduled ? 'has-plan' : ''}
              >
                <option value="">Não treinar</option>
                {plansQuery.data?.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
