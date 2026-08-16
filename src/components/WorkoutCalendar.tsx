import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  isToday,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { fetchMonthSessionProgress } from '../features/workout/api';
import { fetchWeeklySchedule } from '../features/scheduleApi';
import './WorkoutCalendar.css';

const MAX_MONTHS_BACK = 2;
const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function monthLabel(date: Date): string {
  const label = format(date, 'MMMM yyyy', { locale: ptBR });
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function percentClass(percent: number): 'ok' | 'accent' | 'neutral' {
  if (percent >= 100) return 'ok';
  if (percent > 0) return 'accent';
  return 'neutral';
}

export function WorkoutCalendar() {
  const [monthOffset, setMonthOffset] = useState(0);
  const isCurrentMonth = monthOffset === 0;

  const viewedMonth = useMemo(() => addMonths(startOfMonth(new Date()), monthOffset), [monthOffset]);
  const monthKey = format(viewedMonth, 'yyyy-MM');

  const scheduleQuery = useQuery({ queryKey: ['weekly-schedule'], queryFn: fetchWeeklySchedule });
  const progressQuery = useQuery({
    queryKey: ['month-progress', monthKey],
    queryFn: () => fetchMonthSessionProgress(startOfMonth(viewedMonth), endOfMonth(viewedMonth)),
  });

  const scheduledDays = useMemo(
    () => new Set((scheduleQuery.data ?? []).map((d) => d.day_of_week)),
    [scheduleQuery.data]
  );

  const today = startOfDay(new Date());
  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(viewedMonth), end: endOfMonth(viewedMonth) }),
    [viewedMonth]
  );
  const leadingBlanks = startOfMonth(viewedMonth).getDay();

  return (
    <div className="workout-calendar">
      <div className="workout-calendar-header">
        <span className="workout-calendar-eyebrow">Calendário de treinos</span>
        <div className="workout-calendar-nav">
          <button
            type="button"
            className="workout-calendar-nav-btn"
            onClick={() => setMonthOffset((o) => Math.max(o - 1, -MAX_MONTHS_BACK))}
            disabled={monthOffset <= -MAX_MONTHS_BACK}
            aria-label="Mês anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <strong className="workout-calendar-month">{monthLabel(viewedMonth)}</strong>
          <button
            type="button"
            className="workout-calendar-nav-btn"
            onClick={() => setMonthOffset((o) => Math.min(o + 1, 0))}
            disabled={monthOffset >= 0}
            aria-label="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="workout-calendar-grid">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="workout-calendar-weekday">
            {label}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} className="workout-calendar-cell blank" />
        ))}
        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const isWorkoutDay = scheduledDays.has(day.getDay());
          const isFutureDay = isAfter(day, today);
          const percent = progressQuery.data?.[dateKey] ?? (isWorkoutDay && !isFutureDay ? 0 : undefined);
          const clickable = isCurrentMonth && isWorkoutDay && !isFutureDay;

          return (
            <div
              key={dateKey}
              className={`workout-calendar-cell ${isToday(day) ? 'is-today' : ''} ${isWorkoutDay ? 'is-workout-day' : ''}`}
            >
              <span className="workout-calendar-daynum">{day.getDate()}</span>
              {isWorkoutDay &&
                (clickable ? (
                  <Link
                    to={`/treino?date=${dateKey}`}
                    className={`workout-calendar-percent workout-calendar-percent-${percentClass(percent ?? 0)}`}
                  >
                    {percent ?? 0}%
                  </Link>
                ) : (
                  <span
                    className={`workout-calendar-percent workout-calendar-percent-${
                      percent != null ? percentClass(percent) : 'neutral'
                    }`}
                  >
                    {percent != null ? `${percent}%` : '—'}
                  </span>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
