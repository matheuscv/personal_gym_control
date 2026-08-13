import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardList, Trash2 } from 'lucide-react';
import { deletePlan, fetchPlans, updatePlan } from './api';
import './PlansPage.css';

export function PlansPage() {
  const queryClient = useQueryClient();
  const plansQuery = useQuery({ queryKey: ['admin-plans'], queryFn: fetchPlans });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
    queryClient.invalidateQueries({ queryKey: ['active-plans'] });
  }

  const toggleActiveMutation = useMutation({
    mutationFn: (input: { id: number; is_active: boolean }) =>
      updatePlan(input.id, { is_active: input.is_active }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlan,
    onSuccess: invalidate,
  });

  const plans = plansQuery.data ?? [];

  return (
    <div className="admin-section plans-page">
      <span className="plans-eyebrow">Seus planos</span>
      <h2 className="section-title">Planos</h2>
      <p className="import-hint">
        Planos criados em "Criar Plano" ou importados via JSON aparecem todos aqui. Desative um plano pra
        tirá-lo das sugestões sem apagar o histórico.
      </p>

      {plansQuery.isLoading && <p className="admin-status">Carregando...</p>}

      {!plansQuery.isLoading && plans.length === 0 && (
        <p className="library-empty">
          Nenhum plano ainda. Crie um do zero em "Criar Plano" ou importe um JSON.
        </p>
      )}

      <ul className="plans-list">
        {plans.map((plan) => (
          <li key={plan.id} className="plan-card">
            <Link to={`/admin/plans/${plan.id}`} className="plan-card-name">
              <ClipboardList size={16} />
              {plan.name}
            </Link>
            <div className="plan-card-actions">
              <label className="plan-toggle">
                <input
                  type="checkbox"
                  checked={plan.is_active}
                  onChange={(e) => toggleActiveMutation.mutate({ id: plan.id, is_active: e.target.checked })}
                />
                <span className="plan-toggle-track">
                  <span className="plan-toggle-thumb" />
                </span>
                <span className="plan-toggle-label">{plan.is_active ? 'Ativo' : 'Inativo'}</span>
              </label>
              <button
                type="button"
                className="btn-icon"
                aria-label={`Remover ${plan.name}`}
                onClick={() => deleteMutation.mutate(plan.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
