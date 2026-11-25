import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardList, Download, Trash2 } from 'lucide-react';
import { deletePlan, exportAllPlans, fetchPlans, updatePlan } from './api';
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
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      const data = await exportAllPlans();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `meus-planos-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  function handleDelete(plan: { id: number; name: string }) {
    const confirmed = window.confirm(
      `Mover o plano "${plan.name}" pra lixeira? Você pode restaurar em até 30 dias, em Configuração → Lixeira.`
    );
    if (!confirmed) return;
    deleteMutation.mutate(plan.id);
  }

  return (
    <div className="admin-section plans-page">
      <span className="plans-eyebrow">Seus planos</span>
      <h2 className="section-title">Meus Planos</h2>
      <p className="import-hint">
        Planos criados em "Criar Plano" ou importados via JSON aparecem todos aqui. Desative um plano pra
        tirá-lo das sugestões sem apagar o histórico.
      </p>

      <button type="button" className="btn-ghost plans-export-btn" onClick={handleExport} disabled={isExporting}>
        <Download size={14} />
        {isExporting ? 'Exportando...' : 'Exportar meus planos'}
      </button>

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
                onClick={() => handleDelete(plan)}
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
