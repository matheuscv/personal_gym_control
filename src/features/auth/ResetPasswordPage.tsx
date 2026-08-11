import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from './auth-context';
import { PasswordInput } from './PasswordInput';
import './LoginPage.css';

const resetSchema = z
  .object({
    password: z.string().min(6, 'Mínimo de 6 caracteres'),
    confirmPassword: z.string().min(6, 'Mínimo de 6 caracteres'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type ResetForm = z.infer<typeof resetSchema>;

export function ResetPasswordPage() {
  const { session, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm<ResetForm>({ resolver: zodResolver(resetSchema) });

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setFormError(null);
    const { error } = await updatePassword(password);
    if (error) {
      setFormError(error);
    } else {
      setDone(true);
      setTimeout(() => navigate('/'), 1500);
    }
  });

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>Redefinir senha</h1>

        {loading ? (
          <p className="auth-hint">Carregando...</p>
        ) : done ? (
          <p className="auth-success">Senha atualizada com sucesso. Redirecionando...</p>
        ) : !session ? (
          <>
            <p className="auth-hint">
              Este link é inválido ou expirou. Solicite um novo link de redefinição.
            </p>
            <Link to="/login" className="auth-link-button">
              ← Voltar para o login
            </Link>
          </>
        ) : (
          <form onSubmit={onSubmit} noValidate autoComplete="off">
            <label>
              Nova senha
              <PasswordInput autoComplete="new-password" {...form.register('password')} />
              {form.formState.errors.password && (
                <span className="field-error">{form.formState.errors.password.message}</span>
              )}
            </label>
            <label>
              Confirmar nova senha
              <PasswordInput autoComplete="new-password" {...form.register('confirmPassword')} />
              {form.formState.errors.confirmPassword && (
                <span className="field-error">{form.formState.errors.confirmPassword.message}</span>
              )}
            </label>
            {formError && <p className="auth-error">{formError}</p>}
            <button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
