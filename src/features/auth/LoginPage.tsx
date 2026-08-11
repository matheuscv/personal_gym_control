import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from './auth-context';
import { PasswordInput } from './PasswordInput';
import './LoginPage.css';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
});

const signupSchema = loginSchema.extend({
  displayName: z.string().min(1, 'Informe seu nome'),
});

type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;

export function LoginPage() {
  const { session, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [formError, setFormError] = useState<string | null>(null);
  const [signupDone, setSignupDone] = useState(false);

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const signupForm = useForm<SignupForm>({ resolver: zodResolver(signupSchema) });

  if (session) {
    return <Navigate to="/" replace />;
  }

  const onLogin = loginForm.handleSubmit(async ({ email, password }) => {
    setFormError(null);
    const { error } = await signIn(email, password);
    if (error) setFormError(error);
  });

  const onSignup = signupForm.handleSubmit(async ({ email, password, displayName }) => {
    setFormError(null);
    const { error } = await signUp(email, password, displayName);
    if (error) {
      setFormError(error);
    } else {
      setSignupDone(true);
    }
  });

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next);
    setFormError(null);
    setSignupDone(false);
    loginForm.reset();
    signupForm.reset();
  };

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>Personal Gym Control</h1>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => switchMode('login')}
          >
            Entrar
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => switchMode('signup')}
          >
            Cadastrar
          </button>
        </div>

        {signupDone ? (
          <p className="auth-success">
            Cadastro criado. Verifique seu e-mail para confirmar a conta antes de entrar.
          </p>
        ) : mode === 'login' ? (
          <form onSubmit={onLogin} noValidate autoComplete="off">
            <label>
              E-mail
              <input type="email" autoComplete="off" {...loginForm.register('email')} />
              {loginForm.formState.errors.email && (
                <span className="field-error">{loginForm.formState.errors.email.message}</span>
              )}
            </label>
            <label>
              Senha
              <PasswordInput autoComplete="new-password" {...loginForm.register('password')} />
              {loginForm.formState.errors.password && (
                <span className="field-error">{loginForm.formState.errors.password.message}</span>
              )}
            </label>
            {formError && <p className="auth-error">{formError}</p>}
            <button type="submit" disabled={loginForm.formState.isSubmitting}>
              {loginForm.formState.isSubmitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form onSubmit={onSignup} noValidate autoComplete="off">
            <label>
              Nome
              <input autoComplete="off" {...signupForm.register('displayName')} />
              {signupForm.formState.errors.displayName && (
                <span className="field-error">
                  {signupForm.formState.errors.displayName.message}
                </span>
              )}
            </label>
            <label>
              E-mail
              <input type="email" autoComplete="off" {...signupForm.register('email')} />
              {signupForm.formState.errors.email && (
                <span className="field-error">{signupForm.formState.errors.email.message}</span>
              )}
            </label>
            <label>
              Senha
              <PasswordInput autoComplete="new-password" {...signupForm.register('password')} />
              {signupForm.formState.errors.password && (
                <span className="field-error">
                  {signupForm.formState.errors.password.message}
                </span>
              )}
            </label>
            {formError && <p className="auth-error">{formError}</p>}
            <button type="submit" disabled={signupForm.formState.isSubmitting}>
              {signupForm.formState.isSubmitting ? 'Cadastrando...' : 'Cadastrar'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
