import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarOff, CheckCircle2, Clock, Dumbbell } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../features/auth/auth-context';
import { fetchActivePlans, fetchScheduledPlanForDate, fetchTodaySessionStatus } from '../features/workout/api';
import { WorkoutCalendar } from '../components/WorkoutCalendar';
import './HomePage.css';

const TIPS = [
  'Beba água antes, durante e depois do treino.',
  'Aqueça por 5–10 minutos antes de começar — reduz o risco de lesão.',
  'Priorize a técnica correta antes de aumentar a carga.',
  'Descanse pelo menos 48h entre treinos do mesmo grupo muscular.',
  'Durma de 7 a 9 horas — é quando o músculo se recupera.',
  'Consistência importa mais que intensidade: treinar 3x/semana por meses supera treinos esporádicos intensos.',
];

function greetingName(email: string | undefined, displayName: unknown): string {
  if (typeof displayName === 'string' && displayName.trim()) return displayName.trim().split(' ')[0];
  return email?.split('@')[0] ?? 'atleta';
}

function todayLabel(): string {
  const label = format(new Date(), 'EEEE, dd/MM', { locale: ptBR });
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

export function HomePage() {
  const { user } = useAuth();
  const plansQuery = useQuery({ queryKey: ['active-plans'], queryFn: fetchActivePlans });

  const todayKey = format(new Date(), 'yyyy-MM-dd');
  // Mesma queryKey usada por DailyWorkoutPage pra data de hoje — se o
  // usuário for de Home pra Treino do dia, reaproveita o cache.
  const todayScheduleQuery = useQuery({
    queryKey: ['scheduled-plan', todayKey],
    queryFn: () => fetchScheduledPlanForDate(new Date()),
  });
  const todayPlanId = todayScheduleQuery.data?.plan_id ?? null;
  const todayStatusQuery = useQuery({
    queryKey: ['today-session-status', todayPlanId, todayKey],
    queryFn: () => fetchTodaySessionStatus(todayPlanId!, todayKey),
    enabled: todayPlanId != null,
  });

  const name = greetingName(user?.email, user?.user_metadata?.display_name);

  const isLoadingToday = todayScheduleQuery.isLoading || (todayPlanId != null && todayStatusQuery.isLoading);
  const isCompleted = todayStatusQuery.data?.completedAt != null;
  const heroState = !todayScheduleQuery.data ? 'empty' : isCompleted ? 'done' : 'pending';

  return (
    <section className="welcome-page">
      <p className="welcome-eyebrow">Bem-vindo de volta</p>
      <h1>Olá, {name}</h1>

      <div className="welcome-summary">
        {plansQuery.isLoading && <p className="workout-status">Carregando seu plano...</p>}
        {!plansQuery.isLoading && plansQuery.data && plansQuery.data.length > 0 && (
          <p>
            Plano{plansQuery.data.length > 1 ? 's' : ''} ativo{plansQuery.data.length > 1 ? 's' : ''}:{' '}
            <strong>{plansQuery.data.map((p) => p.name).join(', ')}</strong>
          </p>
        )}
        {!plansQuery.isLoading && (!plansQuery.data || plansQuery.data.length === 0) && (
          <p>
            Você ainda não tem um plano de treino ativo. Crie um em{' '}
            <Link to="/admin">Configuração</Link>.
          </p>
        )}
      </div>

      <div className={`today-hero today-hero-${heroState}`}>
        <div className="today-hero-icon-wrap">
          {heroState === 'empty' && <CalendarOff size={24} />}
          {heroState === 'pending' && <Dumbbell size={24} />}
          {heroState === 'done' && <CheckCircle2 size={24} />}
        </div>
        <div className="today-hero-body">
          <span className="today-hero-eyebrow">Treino do dia · {todayLabel()}</span>

          {isLoadingToday && <p className="today-hero-message">Carregando...</p>}

          {!isLoadingToday && heroState === 'empty' && (
            <p className="today-hero-message">
              Você não possui treino agendado para hoje. Clique <Link to="/treino">aqui</Link> para configurar seu
              treino.
            </p>
          )}

          {!isLoadingToday && heroState === 'pending' && (
            <>
              <p className="today-hero-plan">{todayScheduleQuery.data?.plan_name}</p>
              <p className="today-hero-message">
                Você ainda não realizou o treino de hoje, clique <Link to="/treino">aqui</Link> para acessar o seu
                treino.
              </p>
            </>
          )}

          {!isLoadingToday && heroState === 'done' && todayStatusQuery.data?.completedAt && (
            <>
              <p className="today-hero-plan">{todayScheduleQuery.data?.plan_name}</p>
              <div className="today-hero-stats">
                <span className="today-hero-stat">
                  <Clock size={13} />
                  Concluído às {format(new Date(todayStatusQuery.data.completedAt), 'HH:mm')}
                </span>
                <span className="today-hero-stat">
                  <CheckCircle2 size={13} />
                  {todayStatusQuery.data.percent}% concluído
                </span>
              </div>
              <p className="today-hero-message">
                Clique <Link to="/treino">aqui</Link> para ver o resumo do seu treino.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="welcome-cards">
        <Link to="/evolucao" className="welcome-card">
          <span className="section-title">Evolução Treino</span>
          <p>Acompanhe sua carga ao longo do tempo.</p>
        </Link>
        <Link to="/evolucao-corporal" className="welcome-card">
          <span className="section-title">Evolução Corporal</span>
          <p>Veja seus índices de composição corporal.</p>
        </Link>
      </div>

      <WorkoutCalendar />

      <h2 className="section-title">Dicas</h2>
      <ul className="tips-list">
        {TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </section>
  );
}
