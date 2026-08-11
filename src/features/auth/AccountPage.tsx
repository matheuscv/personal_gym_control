import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from './auth-context';
import { PasswordInput } from './PasswordInput';
import './AccountPage.css';

const nameSchema = z.object({
  displayName: z.string().min(1, 'Informe seu nome'),
});

const passwordSchema = z
  .object({
    password: z.string().min(6, 'Mínimo de 6 caracteres'),
    confirmPassword: z.string().min(6, 'Mínimo de 6 caracteres'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type NameForm = z.infer<typeof nameSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export function AccountPage() {
  const { user, updateDisplayName, updatePassword } = useAuth();

  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const currentDisplayName =
    typeof user?.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : '';

  const nameForm = useForm<NameForm>({
    resolver: zodResolver(nameSchema),
    defaultValues: { displayName: currentDisplayName },
  });
  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const onSaveName = nameForm.handleSubmit(async ({ displayName }) => {
    setNameError(null);
    setNameSaved(false);
    const { error } = await updateDisplayName(displayName);
    if (error) {
      setNameError(error);
    } else {
      setNameSaved(true);
    }
  });

  const onSavePassword = passwordForm.handleSubmit(async ({ password }) => {
    setPasswordError(null);
    setPasswordSaved(false);
    const { error } = await updatePassword(password);
    if (error) {
      setPasswordError(error);
    } else {
      setPasswordSaved(true);
      passwordForm.reset();
    }
  });

  return (
    <div className="account-page">
      <h1>Minha conta</h1>

      <div className="account-card">
        <h2 className="section-title">Dados pessoais</h2>
        <form onSubmit={onSaveName} noValidate autoComplete="off">
          <label>
            Nome
            <input autoComplete="off" {...nameForm.register('displayName')} />
            {nameForm.formState.errors.displayName && (
              <span className="field-error">{nameForm.formState.errors.displayName.message}</span>
            )}
          </label>
          <label>
            E-mail
            <input value={user?.email ?? ''} disabled readOnly />
            <span className="account-hint">O e-mail é a chave de acesso e não pode ser alterado.</span>
          </label>
          {nameError && <p className="account-error">{nameError}</p>}
          {nameSaved && <p className="account-success">Nome atualizado.</p>}
          <button type="submit" disabled={nameForm.formState.isSubmitting}>
            {nameForm.formState.isSubmitting ? 'Salvando...' : 'Salvar nome'}
          </button>
        </form>
      </div>

      <div className="account-card">
        <h2 className="section-title">Alterar senha</h2>
        <form onSubmit={onSavePassword} noValidate autoComplete="off">
          <label>
            Nova senha
            <PasswordInput autoComplete="new-password" {...passwordForm.register('password')} />
            {passwordForm.formState.errors.password && (
              <span className="field-error">{passwordForm.formState.errors.password.message}</span>
            )}
          </label>
          <label>
            Confirmar nova senha
            <PasswordInput autoComplete="new-password" {...passwordForm.register('confirmPassword')} />
            {passwordForm.formState.errors.confirmPassword && (
              <span className="field-error">{passwordForm.formState.errors.confirmPassword.message}</span>
            )}
          </label>
          {passwordError && <p className="account-error">{passwordError}</p>}
          {passwordSaved && <p className="account-success">Senha atualizada.</p>}
          <button type="submit" disabled={passwordForm.formState.isSubmitting}>
            {passwordForm.formState.isSubmitting ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
