import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPlan, deletePlan, fetchPlans, updatePlan } from './api';

export function PlansPage() {
  const queryClient = useQueryClient();
  const plansQuery = useQuery({ queryKey: ['admin-plans'], queryFn: fetchPlans });

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
    queryClient.invalidateQueries({ queryKey: ['active-plans'] });
  }

  const createMutation = useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      invalidate();
      setName('');
    },
    onError: (err: Error) => setError(err.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (input: { id: number; is_active: boolean }) =>
      updatePlan(input.id, { is_active: input.is_active }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlan,
    onSuccess: invalidate,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Informe o nome do plano.');
      return;
    }
    createMutation.mutate({ name: name.trim() });
  }

  return (
    <div className="admin-section">
      <h2>Planos</h2>

      <form className="admin-form" onSubmit={handleSubmit}>
        <input placeholder="Nome (ex: Treino A)" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" disabled={createMutation.isPending}>
          Adicionar
        </button>
      </form>
      {error && <p className="admin-error">{error}</p>}

      {plansQuery.isLoading && <p>Carregando...</p>}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Ativo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {plansQuery.data?.map((plan) => (
            <tr key={plan.id}>
              <td>
                <Link to={`/admin/plans/${plan.id}`}>{plan.name}</Link>
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={plan.is_active}
                  onChange={(e) => toggleActiveMutation.mutate({ id: plan.id, is_active: e.target.checked })}
                />
              </td>
              <td>
                <button type="button" onClick={() => deleteMutation.mutate(plan.id)}>
                  Remover
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
