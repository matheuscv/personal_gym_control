import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './features/auth/AuthProvider.tsx'
import { initSentry } from './lib/sentry.ts'

initSentry()

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div className="auth-page">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <h1>Algo deu errado</h1>
            <p className="auth-hint">
              Ocorreu um erro inesperado. Recarregue a página para continuar.
            </p>
            <button type="button" onClick={() => window.location.reload()}>
              Recarregar
            </button>
          </div>
        </div>
      }
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
