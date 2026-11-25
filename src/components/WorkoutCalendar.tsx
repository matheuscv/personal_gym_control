import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Medal, Trophy } from 'lucide-react';
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
import { medalTierForPercent } from '../lib/medal';
import { ProgressRing } from './ProgressRing';
import './WorkoutCalendar.css';

const MAX_MONTHS_BACK = 5;
const MAX_MONTHS_FORWARD = 1;
const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function monthLabel(date: Date): string {
  const label = format(date, 'MMMM yyyy', { locale: ptBR });
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

const MEDAL_HINT: Record<'gold' | 'silver' | 'bronze', string> = {
  gold: 'Você ganhou uma medalha de ouro',
  silver: 'Você ganhou uma medalha de prata',
  bronze: 'Você ganhou uma medalha de bronze',
};
const RECORD_HINT = 'Você obteve um novo recorde';

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

  // Um dia só é "de treino" se a sessão dele (quando existe) não foi
  // cancelada — e, nesse caso, nem importa o que a agenda semanal diz.
  // Só cai pra agenda semanal quando a data ainda não tem sessão nenhuma
  // (nem avulsa, nem cancelada) — mesma precedência de resolveSession.
  function isWorkoutDayFor(dateKey: string, dayOfWeek: number): boolean {
    const info = progressQuery.data?.[dateKey];
    return info ? !info.canceled : scheduledDays.has(dayOfWeek);
  }

  // Média do mês: soma o % de cada dia de treino que já passou (ou é
  // hoje) dividido pela quantidade desses dias — dias de treino ainda no
  // futuro não entram na conta, já que não têm nada "realizado" ainda.
  const { averagePercent, trackedDaysCount } = useMemo(() => {
    const relevantDays = days.filter((d) => {
      const info = progressQuery.data?.[format(d, 'yyyy-MM-dd')];
      const isWorkoutDay = info ? !info.canceled : scheduledDays.has(d.getDay());
      return isWorkoutDay && !isAfter(d, today);
    });
    if (relevantDays.length === 0) return { averagePercent: null as number | null, trackedDaysCount: 0 };
    const total = relevantDays.reduce((sum, d) => {
      const key = format(d, 'yyyy-MM-dd');
      return sum + (progressQuery.data?.[key]?.percent ?? 0);
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
          const isWorkoutDay = isWorkoutDayFor(dateKey, day.getDay());
          const isFutureDay = isAfter(day, today);
          // Dia passado (não hoje) sem nada realizado não tem nada pra
          // ver lá — só mostra o link se houver >=1% de progresso, ou se
          // for hoje/futuro (futuro agora também é navegável direto daqui).
          const isPastDay = !isToday(day) && !isFutureDay;
          const percent = progressQuery.data?.[dateKey]?.percent ?? (isWorkoutDay && !isFutureDay ? 0 : undefined);
          const clickable = isCurrentMonth && isWorkoutDay && !(isPastDay && (percent ?? 0) === 0);
          const level = cellLevel(isWorkoutDay, isFutureDay, percent ?? 0);
          const className = `workout-calendar-cell level-${level} ${isToday(day) ? 'is-today' : ''}`;
          const medalTier = isWorkoutDay && !isFutureDay ? medalTierForPercent(percent ?? 0) : null;
          const hasRecord = !isFutureDay && (progressQuery.data?.[dateKey]?.hasRecord ?? false);

          const content = (
            <>
              {hasRecord && (
                <span className="workout-calendar-trophy-wrap" title={RECORD_HINT} aria-label={RECORD_HINT}>
                  <Trophy size={10} className="workout-calendar-trophy medal-gold" />
                </span>
              )}
              <span className="workout-calendar-daynum">{day.getDate()}</span>
              {isWorkoutDay && !isFutureDay && (
                <span className="workout-calendar-percent-row">
                  <span className="workout-calendar-percent-inline">{percent ?? 0}%</span>
                  {medalTier && (
                    <span title={MEDAL_HINT[medalTier]} aria-label={MEDAL_HINT[medalTier]}>
                      <Medal size={10} className={`workout-calendar-medal medal-${medalTier}`} />
                    </span>
                  )}
                </span>
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
