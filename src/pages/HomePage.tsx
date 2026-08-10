import { useAuth } from '../features/auth/auth-context';

export function HomePage() {
  const { user, signOut } = useAuth();

  return (
    <section className="home-page">
      <header className="home-header">
        <span>{user?.email}</span>
        <button type="button" onClick={() => signOut()}>
          Sair
        </button>
      </header>
      <h1>Treino do dia</h1>
      <p>Em breve: tela diária de treino baseada no plano ativo.</p>
    </section>
  );
}
