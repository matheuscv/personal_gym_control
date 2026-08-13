import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { AccountPage } from './features/auth/AccountPage';
import { InvitePage } from './features/auth/InvitePage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { AppShell } from './components/AppShell';
import { HomePage } from './pages/HomePage';
import { DailyWorkoutPage } from './features/workout/DailyWorkoutPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { BodyDashboardPage } from './features/dashboard/BodyDashboardPage';
import './App.css';

// As telas admin (CRUD/importador) são exclusivas da versão web. Ao construir
// para Android (VITE_PLATFORM=android), a condição abaixo é resolvida em
// tempo de build (Vite substitui import.meta.env.VITE_PLATFORM por um
// literal), permitindo que o Rollup elimine os import() dinâmicos junto —
// as telas admin nem entram no bundle, não é apenas ocultação em runtime.
const IS_ANDROID = import.meta.env.VITE_PLATFORM === 'android';

const AdminLayout = IS_ANDROID
  ? null
  : lazy(() => import('./features/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const MySchedulePage = IS_ANDROID
  ? null
  : lazy(() => import('./features/admin/MySchedulePage').then((m) => ({ default: m.MySchedulePage })));
const PlansPage = IS_ANDROID
  ? null
  : lazy(() => import('./features/admin/PlansPage').then((m) => ({ default: m.PlansPage })));
const PlanDetailPage = IS_ANDROID
  ? null
  : lazy(() => import('./features/admin/PlanDetailPage').then((m) => ({ default: m.PlanDetailPage })));
const ImportPlanPage = IS_ANDROID
  ? null
  : lazy(() => import('./features/admin/ImportPlanPage').then((m) => ({ default: m.ImportPlanPage })));
const CreatePlanPage = IS_ANDROID
  ? null
  : lazy(() => import('./features/admin/CreatePlanPage').then((m) => ({ default: m.CreatePlanPage })));
const BodyReportPage = IS_ANDROID
  ? null
  : lazy(() => import('./features/admin/BodyReportPage').then((m) => ({ default: m.BodyReportPage })));
const ImportBodyReportPage = IS_ANDROID
  ? null
  : lazy(() =>
      import('./features/admin/ImportBodyReportPage').then((m) => ({ default: m.ImportBodyReportPage }))
    );

function App() {
  return (
    <Suspense fallback={<p className="auth-loading">Carregando...</p>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/treino" element={<DailyWorkoutPage />} />
            <Route path="/evolucao" element={<DashboardPage />} />
            <Route path="/evolucao-corporal" element={<BodyDashboardPage />} />
            <Route path="/conta" element={<AccountPage />} />
            <Route path="/convidar" element={<InvitePage />} />
            {AdminLayout &&
              MySchedulePage &&
              PlansPage &&
              PlanDetailPage &&
              ImportPlanPage &&
              CreatePlanPage &&
              BodyReportPage &&
              ImportBodyReportPage && (
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="schedule" replace />} />
                  <Route path="schedule" element={<MySchedulePage />} />
                  <Route path="plans" element={<PlansPage />} />
                  <Route path="plans/:planId" element={<PlanDetailPage />} />
                  <Route path="import" element={<ImportPlanPage />} />
                  <Route path="create-plan" element={<CreatePlanPage />} />
                  <Route path="body-report" element={<BodyReportPage />} />
                  <Route path="body-report/import" element={<ImportBodyReportPage />} />
                </Route>
              )}
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
