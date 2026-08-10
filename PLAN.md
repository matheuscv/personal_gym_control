# Plano de Execução — personal_gym_control

> Documento vivo de acompanhamento. Cada fase é atualizada (checkbox marcado + nota de data) conforme o desenvolvimento avança. Referência completa da proposta: `Proposta_Implementação.html`.

**Início:** 10/08/2026
**Status geral:** 🟢 Fase 0 concluída — Fase 1 em andamento

---

## Decisões confirmadas (não reabrir sem necessidade)

- Multi-usuário desde o início, cada usuário administra os próprios dados (RLS por `owner_id`).
- Android distribuído via APK manual (sideload) — sem Google Play.
- Hospedagem 100% Vercel (Hobby, free) — sem Render.
- Sem API paga de IA — interação via chat direto com o Claude + importação de JSON nas telas admin.
- Relatórios de composição corporal: sem upload/armazenamento de imagem no Supabase — só dados numéricos.
- Stack: React + TypeScript + Vite, Node (Vercel Serverless Functions), Supabase (Postgres + Auth), Capacitor para Android.

---

## Fase 0 — Infraestrutura

- [x] Scaffold do projeto (Vite + React + TS) em `personal_gym_control/`
- [x] Estrutura de pastas (`src/`, `api/`, `supabase/migrations/`)
- [x] Dependências base instaladas (`react-router-dom`, `@supabase/supabase-js`, `zod`, `react-hook-form`, `@tanstack/react-query`, `date-fns`)
- [x] `.env.example`, `.gitignore` ajustado, `README.md`
- [x] Função serverless placeholder (`api/health.ts`)
- [x] Git local inicializado + primeiro commit
- [x] Repositório remoto no GitHub criado e conectado (`github.com/matheuscv/personal_gym_control`)
- [x] Projeto Supabase criado (dashboard) — URL e anon key recebidas e configuradas em `.env` local
- [x] `supabase link` (CLI) — login via personal access token, `supabase link --project-ref qgyczvzdysvjlrgrffuz` e `migration repair` para sincronizar histórico da migration `profiles` aplicada manualmente
- [x] Projeto Vercel criado/linkado (`vercel link`) — conectado ao GitHub (deploy automático a cada push)
- [x] Variáveis de ambiente configuradas no Vercel (produção e development). Preview adiado deliberadamente — bug do CLI ao configurar sem branch específica; será resolvido junto com a criação da 1ª branch da Fase 1 (env var associada diretamente à branch)
- [x] Migration SQL inicial escrita (`profiles` + trigger de auto-criação no signup)
- [x] Migration aplicada no banco remoto (via SQL Editor do dashboard) — verificado via REST API (HTTP 200)

## Fase 1 — Seção Treino

- [x] Migrations: `exercises`, `workout_plans`, `workout_plan_exercises`, `workout_sessions`, `workout_session_sets` (+ políticas RLS)
- [x] Tela de login/cadastro (Supabase Auth)
- [x] Tela diária de treino (baseada no HTML 1), dados dinâmicos via Supabase
- [x] Registro de séries (peso/tempo, concluído) persistido por sessão
- [ ] Tela Admin (web-only): CRUD manual de planos A/B/C
- [ ] Tela Admin (web-only): importador de JSON de plano de treino + validação (Zod, `/api`)
- [ ] Dashboard de evolução de treino (carga máxima por exercício ao longo do tempo)
- [ ] Separação de bundle web vs android (rotas admin fora do build Android)

## Fase 2 — Seção Evolução Corporal

- [ ] Migrations: `body_reports`, `body_metrics` (+ políticas RLS)
- [ ] Tela Admin (web-only): novo relatório — formulário manual (~18 campos) espelhando o layout Fitdays
- [ ] Tela Admin (web-only): importador de JSON de relatório (colado a partir da leitura feita no chat) + validação (Zod, `/api`)
- [ ] Dashboard de evolução corporal (baseado no HTML 2): gráficos por índice, tabela histórica, KPIs
- [ ] Dashboard consumido também no build Android (somente leitura)

## Fase 3 — App Android (Capacitor)

- [ ] `npx cap init` + `npx cap add android`
- [ ] Build Android sem rotas/telas admin (variável `VITE_PLATFORM=android`)
- [ ] Geração de APK local (Android Studio) e instalação/teste no celular
- [ ] (Opcional) GitHub Actions para gerar APK automaticamente a cada release

## Fase 4 — Multi-usuário e polimento

- [ ] Fluxo de cadastro/convite de novos usuários
- [ ] Revisão de segurança das políticas RLS (teste de isolamento entre usuários)
- [ ] PWA (manifest + service worker) para instalar a versão web em desktop/iOS
- [ ] Offline-first na tela de treino do dia (fila local, sincroniza ao voltar a conexão)
- [ ] Monitoramento de erros (opcional, ex. Sentry free tier)

---

## Pendências que dependem de você

Estas ações precisam de login/credenciais suas e não posso executar sozinho neste ambiente:

1. **GitHub**: CLI `gh` não está instalado aqui. Ou (a) instale o [GitHub CLI](https://cli.github.com/) e rode `gh auth login`, ou (b) crie o repositório manualmente em github.com (`personal_gym_control`, privado) e me passe a URL remota para eu configurar o `git remote` e dar push.
2. **Vercel**: CLI já instalado, mas sem login. Rode `vercel login` (abre o navegador) e me avise quando terminar — eu sigo com `vercel link` e configuração das env vars.
3. **Supabase**: CLI disponível via `npx supabase`, mas sem projeto criado. Crie um projeto em [supabase.com/dashboard](https://supabase.com/dashboard) (free tier) e me passe a **Project URL** e a **anon key** (e a **service role key**, com cuidado — só vai para variável de ambiente do backend, nunca para o frontend).

## Changelog

- **10/08/2026** — Tela diária de treino implementada (seleção de plano ativo, geração automática das séries-alvo, registro de reps/peso/tempo/concluída persistido no Supabase). TanStack Query conectado. Testada via agent-browser com dados seedados via SQL (fluxo completo, incluindo retomada de sessão sem duplicar), depois removidos.
- **10/08/2026** — Tela de login/cadastro implementada (AuthProvider + LoginPage + ProtectedRoute), com validação Zod/react-hook-form. Testada via agent-browser (validação de formulário e cadastro real, com limpeza da conta de teste depois).
- **10/08/2026** — Migration `workout_schema` (exercises, workout_plans, workout_plan_exercises, workout_sessions, workout_session_sets + RLS) criada e aplicada no banco remoto via `supabase db push`. Chaves primárias `bigint identity`, `owner_id` denormalizado em todas as tabelas para RLS performático (sem joins), índices em todas as FKs.
- **10/08/2026** — Decisão: env vars de Preview no Vercel ficam adiadas para quando a 1ª branch da Fase 1 for criada (associação direta branch → env var). **Fase 0 100% concluída** (dado esse adiamento deliberado).
- **10/08/2026** — `supabase link` concluído (login via token pessoal, project-ref vinculado, histórico de migrations sincronizado via `migration repair`).
- **10/08/2026** — Projeto criado, Fase 0 iniciada (scaffold local completo).
- **10/08/2026** — Repositório remoto conectado e commit inicial enviado ao GitHub.
- **10/08/2026** — Credenciais do Supabase recebidas, cliente configurado e migration inicial (`profiles`) escrita — falta aplicar no banco remoto.
- **10/08/2026** — Migration `profiles` aplicada no banco remoto (via SQL Editor) e verificada via REST API.
- **10/08/2026** — Login no Vercel concluído, projeto linkado e conectado ao GitHub, variáveis de ambiente do Supabase configuradas (produção/development). **Fase 0 concluída** (exceto preview env vars e `supabase link`, ambos de baixa prioridade).
