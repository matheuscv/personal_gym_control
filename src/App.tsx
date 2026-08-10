import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { AdminLayout } from './features/admin/AdminLayout';
import { ExercisesPage } from './features/admin/ExercisesPage';
import { PlansPage } from './features/admin/PlansPage';
import { PlanDetailPage } from './features/admin/PlanDetailPage';
import { ImportPlanPage } from './features/admin/ImportPlanPage';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="exercises" replace />} />
          <Route path="exercises" element={<ExercisesPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="plans/:planId" element={<PlanDetailPage />} />
          <Route path="import" element={<ImportPlanPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
