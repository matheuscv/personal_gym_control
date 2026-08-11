# Plano de Execução — personal_gym_control

> Documento vivo de acompanhamento. Cada fase é atualizada (checkbox marcado + nota de data) conforme o desenvolvimento avança. Referência completa da proposta: `Proposta_Implementação.html`.

**Início:** 10/08/2026
**Status geral:** 🟢 Fases 0, 1, 2 e 3 concluídas — próxima: Fase 4 (Multi-usuário e polimento)

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
- [x] Tela Admin (web-only): CRUD manual de planos A/B/C
- [x] Tela Admin (web-only): importador de JSON de plano de treino + validação (Zod, `/api`)
- [x] Dashboard de evolução de treino (carga máxima por exercício ao longo do tempo)
- [x] Separação de bundle web vs android (rotas admin fora do build Android)

## Fase 2 — Seção Evolução Corporal

- [x] Migrations: `body_reports`, `body_metrics` (+ políticas RLS) — 18 campos de índices decididos com o usuário (não havia referência exata disponível, HTML 2 original não estava no repositório)
- [x] Tela Admin (web-only): novo relatório — formulário manual (18 campos) + lista com editar/remover
- [x] Tela Admin (web-only): importador de JSON de relatório + validação (Zod, `/api`)
- [x] Dashboard de evolução corporal: KPIs, gráfico por índice selecionável, tabela histórica
- [x] Dashboard consumido também no build Android (somente leitura — herda a exclusão das rotas admin)

## Fase 3 — App Android (Capacitor)

- [x] `npx cap init` (appId `com.matheuscv.personalgymcontrol`) + `npx cap add android`
- [x] Build Android sem rotas/telas admin (`npm run build:android`) — confirmado que os assets copiados para `android/app/src/main/assets/public` não contêm nenhum chunk admin
- [x] Geração de APK — **via GitHub Actions**, não local (ambiente sem Android Studio/SDK; só JDK 8, antigo demais). Primeiro APK gerado com sucesso em 11/08/2026 (run [31514424616](https://github.com/matheuscv/personal_gym_control/actions/runs/31514424616)). Instalação no celular (sideload) é manual, feita pelo usuário
- [x] GitHub Actions para gerar APK (`.github/workflows/android-apk.yml`, debug build) — dispara a cada push na `main`, manualmente, ou por tag `v*`. Secrets `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` configurados pelo usuário no repositório

## Fase 4 — Multi-usuário e polimento

- [ ] Fluxo de cadastro/convite de novos usuários
- [ ] Revisão de segurança das políticas RLS (teste de isolamento entre usuários)
- [ ] PWA (manifest + service worker) para instalar a versão web em desktop/iOS
- [ ] Offline-first na tela de treino do dia (fila local, sincroniza ao voltar a conexão)
- [ ] Monitoramento de erros (opcional, ex. Sentry free tier)

---

## Pendências que dependem de você

1. **Instalação do APK no celular**: baixe o `.apk` mais recente em [Actions → Build Android APK](https://github.com/matheuscv/personal_gym_control/actions/workflows/android-apk.yml) (artifact `personal-gym-control-debug-apk`) e instale manualmente (habilitar "fontes desconhecidas" no Android) — não há como eu fazer isso remotamente. O workflow roda automaticamente a cada push na `main`, então sempre há uma versão atualizada disponível.

## Changelog

- **11/08/2026** — Corrigido `site_url` do Supabase Auth (estava com o padrão `localhost:3000`, causando redirecionamento quebrado no link de confirmação de e-mail) — agora aponta para `https://personalgymcontrol.vercel.app`, sincronizado via `supabase config push`. Adicionado botão de mostrar/ocultar senha (ícone de olho) nos campos de senha do login/cadastro.
- **11/08/2026** — **Fase 3 concluída.** Workflow do GitHub Actions ajustado para rodar a cada push na `main` (além de manual/tag). Primeiro APK de debug gerado com sucesso após corrigir 3 problemas encontrados nos testes reais: (1) `android/gradlew` sem permissão de execução — commitado no Windows, runner Linux não conseguia rodar `./gradlew`; (2) log de erro do job não é baixável via API sem admin no repo mesmo sendo público — passou a salvar o log como artifact (esses são baixáveis publicamente); (3) causa raiz do build falhar: workflow usava JDK 17, mas `@capacitor/android` 8.x exige JDK 21 (erro `invalid source release: 21`). Diagnóstico feito consultando a API REST do GitHub diretamente (repositório é público), sem precisar do `gh` CLI.
- **11/08/2026** — Fase 3 iniciada: scaffold Android via Capacitor (`cap init` + `cap add android`), confirmado que a separação de bundle da Fase 1 se propaga corretamente para os assets nativos. Corrigido `.gitignore` raiz que ignorava `/android` inteiro (herdado do scaffold da Fase 0) — o projeto nativo deve ser versionado. Como este ambiente não tem Android Studio/SDK (só JDK 8, antigo demais), decidido com o usuário usar GitHub Actions para gerar o APK de debug na nuvem — workflow criado, pendente configuração de secrets pelo usuário (ver Pendências).
- **11/08/2026** — **Fase 2 concluída.** Seção Evolução Corporal completa: migrations `body_reports`/`body_metrics` (18 campos de índices confirmados com o usuário), formulário manual + importador JSON no Admin, dashboard com KPIs/gráfico por índice/tabela histórica (disponível também no Android, somente leitura). Bug real encontrado e corrigido nos testes: `body_metrics.report_id` é `unique`, então o PostgREST embute a relação como objeto único (não array) — código assumia array e usava `?.[0]`, perdendo todos os dados.
- **11/08/2026** — **Fase 1 concluída.** Dashboard de evolução de treino (`/evolucao`, gráfico de carga máxima por exercício via Chart.js) e separação real de bundle web/Android (rotas admin em `React.lazy` + condição `VITE_PLATFORM=android` resolvida em build-time, eliminando os `import()` do bundle Android — confirmado comparando os dois builds: nenhum chunk de admin no build Android). Novo script `npm run build:android`.
- **11/08/2026** — Deploy de fim de sessão: encontrados e corrigidos 2 bugs críticos que deixavam toda a API (`/api/*`) inoperante em produção, só perceptíveis após deploy real (não reproduziam em `vercel dev` local, que trava neste ambiente): (1) `export default function` é o formato legado `(req,res)`, não o Web-standard — corrigido para `export function fetch`; (2) o bundler de funções do Vercel não inclui imports relativos locais entre arquivos (só pacotes de `node_modules`) — `api/import-workout-plan.ts` tornado autocontido, sem imports locais. Ambos endpoints (`/api/health`, `/api/import-workout-plan`) e o fluxo completo de importação autenticada testados e confirmados funcionando em produção real (`personalgymcontrol.vercel.app`).
- **10/08/2026** — Importador de JSON de plano de treino (`/api/import-workout-plan`, Zod compartilhado com o frontend, upsert idempotente por nome). `api/` passou a ser type-checked. Lógica testada chamando o handler diretamente (sem `vercel dev`, que trava neste ambiente); teste E2E de rede pendente para após o próximo deploy. **Combinado com o usuário: deploy no Vercel só ao final da sessão, não a cada etapa** (o push automático já dispara deploy, então os commits ficam só locais até então).
- **10/08/2026** — Tela Admin (CRUD de exercícios e planos A/B/C, com adicionar/reordenar/editar exercícios do plano). Migration de correção: troca de ordem via função de banco (`swap_plan_exercise_order`) para evitar conflito com a constraint unique durante o swap. Testada via agent-browser ponta a ponta; usuário de teste criado via Admin API do Supabase (rate limit de e-mail do signup normal foi atingido) e removido ao final.
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
