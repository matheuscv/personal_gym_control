# personal_gym_control

Aplicação de controle de treinos de academia e evolução de composição corporal, com versão web e versão Android (Capacitor) compartilhando a mesma base de dados (Supabase).

Proposta completa: ver `Proposta_Implementação.html` (na raiz do workspace, um nível acima).
Acompanhamento de fases: ver [`PLAN.md`](./PLAN.md).

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js (Vercel Serverless Functions em `/api`)
- Banco de dados / Auth: Supabase (Postgres + RLS)
- App Android: Capacitor (empacota o mesmo frontend)
- Deploy: Vercel (Hobby, free)

## Estrutura

```
src/          → frontend React
api/          → funções serverless Node (Vercel)
supabase/     → config local + migrations (SQL)
android/      → gerado pelo Capacitor (fase 3)
```

## Setup local

```bash
npm install
cp .env.example .env   # preencher com as credenciais do projeto Supabase
npm run dev
```

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build de produção
- `npm run lint` — lint (oxlint)
- `npm run preview` — preview do build
