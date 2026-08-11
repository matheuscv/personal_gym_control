import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../features/auth/auth-context';
import { fetchActivePlans } from '../features/workout/api';
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

export function HomePage() {
  const { user } = useAuth();
  const plansQuery = useQuery({ queryKey: ['active-plans'], queryFn: fetchActivePlans });

  const name = greetingName(user?.email, user?.user_metadata?.display_name);

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
            <Link to="/admin">Admin</Link>.
          </p>
        )}
      </div>

      <div className="welcome-cards">
        <Link to="/treino" className="welcome-card">
          <span className="section-title">Treino do dia</span>
          <p>Registre suas séries de hoje.</p>
        </Link>
        <Link to="/evolucao" className="welcome-card">
          <span className="section-title">Evolução Treino</span>
          <p>Acompanhe sua carga ao longo do tempo.</p>
        </Link>
        <Link to="/evolucao-corporal" className="welcome-card">
          <span className="section-title">Evolução Corporal</span>
          <p>Veja seus índices de composição corporal.</p>
        </Link>
      </div>

      <h2 className="section-title">Dicas</h2>
      <ul className="tips-list">
        {TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </section>
  );
}
