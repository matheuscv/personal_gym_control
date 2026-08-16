import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from './auth-context';
import { PasswordInput } from './PasswordInput';
import './LoginPage.css';

const IS_ANDROID = import.meta.env.VITE_PLATFORM === 'android';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
});

const signupSchema = loginSchema.extend({
  displayName: z.string().min(1, 'Informe seu nome'),
});

const forgotSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;
type ForgotForm = z.infer<typeof forgotSchema>;

type Mode = 'login' | 'signup' | 'forgot';

export function LoginPage() {
  const { session, signIn, signUp, sendPasswordReset, resendConfirmationEmail } = useAuth();
  const [searchParams] = useSearchParams();
  const inviteEmail = searchParams.get('convite');
  const [mode, setMode] = useState<Mode>(inviteEmail ? 'signup' : 'login');
  const [formError, setFormError] = useState<string | null>(null);
  const [signupDone, setSignupDone] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const signupForm = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: inviteEmail ? { email: inviteEmail } : undefined,
  });
  const forgotForm = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

  if (session) {
    return <Navigate to="/" replace />;
  }

  const onLogin = loginForm.handleSubmit(async ({ email, password }) => {
    setFormError(null);
    setShowResendConfirmation(false);
    const { error } = await signIn(email, password);
    if (error) {
      setFormError(error);
      if (/not confirmed/i.test(error)) {
        setShowResendConfirmation(true);
      }
    }
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

  const onForgot = forgotForm.handleSubmit(async ({ email }) => {
    setFormError(null);
    const { error } = await sendPasswordReset(email);
    if (error) {
      setFormError(error);
    } else {
      setForgotDone(true);
    }
  });

  const handleResendConfirmation = async () => {
    const email = loginForm.getValues('email');
    if (!email) return;
    const { error } = await resendConfirmationEmail(email);
    if (error) {
      setFormError(error);
    } else {
      setResendDone(true);
      setShowResendConfirmation(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setFormError(null);
    setSignupDone(false);
    setForgotDone(false);
    setShowResendConfirmation(false);
    setResendDone(false);
    loginForm.reset();
    signupForm.reset();
    forgotForm.reset();
  };

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>Personal Gym Control</h1>

        {mode !== 'forgot' && (
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
        )}

        {signupDone ? (
          <p className="auth-success">
            Cadastro criado. Verifique seu e-mail para confirmar a conta antes de entrar.
          </p>
        ) : mode === 'forgot' ? (
          forgotDone ? (
            <p className="auth-success">
              Se esse e-mail estiver cadastrado, enviamos um link para redefinir a senha.
            </p>
          ) : (
            <form onSubmit={onForgot} noValidate autoComplete="off">
              <p className="auth-hint">Informe seu e-mail para receber um link de redefinição de senha.</p>
              <label>
                E-mail
                <input type="email" autoComplete="off" {...forgotForm.register('email')} />
                {forgotForm.formState.errors.email && (
                  <span className="field-error">{forgotForm.formState.errors.email.message}</span>
                )}
              </label>
              {formError && <p className="auth-error">{formError}</p>}
              <button type="submit" disabled={forgotForm.formState.isSubmitting}>
                {forgotForm.formState.isSubmitting ? 'Enviando...' : 'Enviar link de redefinição'}
              </button>
              <button type="button" className="auth-link-button" onClick={() => switchMode('login')}>
                ← Voltar para o login
              </button>
            </form>
          )
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
            {showResendConfirmation && !resendDone && (
              <button type="button" className="auth-link-button" onClick={handleResendConfirmation}>
                Reenviar e-mail de confirmação
              </button>
            )}
            {resendDone && <p className="auth-success">E-mail de confirmação reenviado.</p>}
            <button type="submit" disabled={loginForm.formState.isSubmitting}>
              {loginForm.formState.isSubmitting ? 'Entrando...' : 'Entrar'}
            </button>
            <button type="button" className="auth-link-button" onClick={() => switchMode('forgot')}>
              Esqueci minha senha
            </button>
          </form>
        ) : (
          <form onSubmit={onSignup} noValidate autoComplete="off">
            {inviteEmail && (
              <p className="auth-hint">Você foi convidado(a) para o Personal Gym Control — crie sua conta abaixo.</p>
            )}
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
      {IS_ANDROID && (
        <span className="auth-version" title={`Commit ${__APP_COMMIT__}`}>
          v{__APP_VERSION__}
        </span>
      )}
    </section>
  );
}
