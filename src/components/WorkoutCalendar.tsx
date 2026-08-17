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
import { ProgressRing } from './ProgressRing';
import './WorkoutCalendar.css';

const MAX_MONTHS_BACK = 5;
const MAX_MONTHS_FORWARD = 1;
const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function monthLabel(date: Date): string {
  const label = format(date, 'MMMM yyyy', { locale: ptBR });
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function cellLevel(isWorkoutDay: boolean, isFutureDay: boolean, percent: number): 'none' | 'scheduled' | 'ok' | 'accent' | 'zero' {
  if (!isWorkoutDay) return 'none';
  if (isFutureDay) return 'scheduled';
  if (percent >= 100) return 'ok';
  if (percent > 0) return 'accent';
  return 'zero';
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

  // Média do mês: soma o % de cada dia de treino que já passou (ou é
  // hoje) dividido pela quantidade desses dias — dias de treino ainda no
  // futuro não entram na conta, já que não têm nada "realizado" ainda.
  const { averagePercent, trackedDaysCount } = useMemo(() => {
    const relevantDays = days.filter((d) => scheduledDays.has(d.getDay()) && !isAfter(d, today));
    if (relevantDays.length === 0) return { averagePercent: null as number | null, trackedDaysCount: 0 };
    const total = relevantDays.reduce((sum, d) => {
      const key = format(d, 'yyyy-MM-dd');
      return sum + (progressQuery.data?.[key] ?? 0);
    }, 0);
    return { averagePercent: Math.round(total / relevantDays.length), trackedDaysCount: relevantDays.length };
  }, [days, scheduledDays, today, progressQuery.data]);

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
            onClick={() => setMonthOffset((o) => Math.min(o + 1, MAX_MONTHS_FORWARD))}
            disabled={monthOffset >= MAX_MONTHS_FORWARD}
            aria-label="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="workout-calendar-summary">
        {averagePercent != null ? (
          <ProgressRing percent={averagePercent} size={62} strokeWidth={6} />
        ) : (
          <div className="workout-calendar-summary-empty">—</div>
        )}
        <div className="workout-calendar-summary-text">
          <span className="workout-calendar-summary-label">Média de conclusão do mês</span>
          <span className="workout-calendar-summary-caption">
            {trackedDaysCount > 0
              ? `${trackedDaysCount} dia${trackedDaysCount === 1 ? '' : 's'} de treino contabilizado${trackedDaysCount === 1 ? '' : 's'}`
              : 'Ainda não há dias de treino neste mês'}
          </span>
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
          const level = cellLevel(isWorkoutDay, isFutureDay, percent ?? 0);
          const className = `workout-calendar-cell level-${level} ${isToday(day) ? 'is-today' : ''}`;

          const content = (
            <>
              <span className="workout-calendar-daynum">{day.getDate()}</span>
              {isWorkoutDay && !isFutureDay && (
                <span className="workout-calendar-percent-inline">{percent ?? 0}%</span>
              )}
              {isWorkoutDay && isFutureDay && <span className="workout-calendar-dot" />}
            </>
          );

          return clickable ? (
            <Link key={dateKey} to={`/treino?date=${dateKey}`} className={className}>
              {content}
            </Link>
          ) : (
            <div key={dateKey} className={className}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
