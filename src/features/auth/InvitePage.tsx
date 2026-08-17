import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Copy } from 'lucide-react';
import './InvitePage.css';

// Link de convite sempre aponta pra produção, mesmo gerado a partir do
// servidor local (window.location.origin mostraria localhost) — mesma
// URL usada como site_url no Supabase Auth (ver supabase/config.toml).
const APP_URL = 'https://personalgymcontrol.vercel.app';

const inviteSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

type InviteForm = z.infer<typeof inviteSchema>;

export function InvitePage() {
  const form = useForm<InviteForm>({ resolver: zodResolver(inviteSchema) });
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const onGenerate = form.handleSubmit(({ email }) => {
    setCopied(false);
    setLink(`${APP_URL}/login?convite=${encodeURIComponent(email)}`);
  });

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return (
    <div className="invite-page">
      <h1>Convidar alguém</h1>
      <div className="invite-card">
        <p className="invite-hint">
          Informe o e-mail da pessoa que você quer convidar. Vamos gerar um link para a tela de cadastro,
          já com o e-mail preenchido — copie e envie por onde preferir (WhatsApp, e-mail, etc.).
        </p>

        <form
          onSubmit={onGenerate}
          noValidate
          autoComplete="off"
          onChange={() => {
            setLink(null);
            setCopied(false);
          }}
        >
          <label>
            E-mail da pessoa convidada
            <input type="email" autoComplete="off" {...form.register('email')} />
            {form.formState.errors.email && (
              <span className="field-error">{form.formState.errors.email.message}</span>
            )}
          </label>
          <button type="submit">Gerar link de convite</button>
        </form>

        {link && (
          <div className="invite-link-row">
            <input value={link} readOnly onFocus={(e) => e.target.select()} />
            <button type="button" onClick={handleCopy} className="invite-copy-btn">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
