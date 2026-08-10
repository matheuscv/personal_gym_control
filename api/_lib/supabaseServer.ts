import { createClient } from '@supabase/supabase-js';

export function supabaseForRequest(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Variáveis de ambiente do Supabase ausentes no servidor.');
  }

  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
}
