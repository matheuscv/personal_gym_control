import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, RotateCcw, Trash2 } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import { fetchTrashItems, hardDeleteTrashItem, purgeExpiredTrash, restoreTrashItem, TRASH_RETENTION_DAYS } from '../trashApi';
import type { TrashItem } from '../trashApi';
import './TrashPage.css';

function daysSince(deletedAt: string): number {
  return differenceInCalendarDays(new Date(), new Date(deletedAt));
}

export function TrashPage() {
  const queryClient = useQueryClient();
  // Purga oportunista do que já passou da validade, só uma vez ao abrir a
  // tela — mesmo padrão de limpeza "ao carregar" já usado em
  // workout/api.ts (loadDailyWorkout) pras séries órfãs.
  const [purged, setPurged] = useState(false);
  useEffect(() => {
    purgeExpiredTrash().finally(() => setPurged(true));
  }, []);

  const trashQuery = useQuery({ queryKey: ['trash-items'], queryFn: fetchTrashItems, enabled: purged });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['trash-items'] });
    queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
    queryClient.invalidateQueries({ queryKey: ['active-plans'] });
    queryClient.invalidateQueries({ queryKey: ['admin-plan-exercises'] });
    queryClient.invalidateQueries({ queryKey: ['admin-body-reports'] });
    queryClient.invalidateQueries({ queryKey: ['body-progress'] });
  }

  async function handleRestore(item: TrashItem) {
    await restoreTrashItem(item.kind, item.id);
    invalidate();
  }

  async function handleHardDelete(item: TrashItem) {
    const confirmed = window.confirm(
      `Excluir "${item.label}" definitivamente? Isso não pode ser desfeita — nem pela lixeira.`
    );
    if (!confirmed) return;
    await hardDeleteTrashItem(item.kind, item.id);
    invalidate();
  }

  const items = trashQuery.data ?? [];

  return (
    <div className="admin-section trash-page">
      <span className="trash-eyebrow">Itens apagados</span>
      <h2 className="section-title">Lixeira</h2>
      <p className="import-hint">
        Planos, exercícios de plano e relatórios corporais excluídos ficam aqui por {TRASH_RETENTION_DAYS} dias
        antes de serem apagados de vez — dá pra restaurar em qualquer momento antes disso.
      </p>

      {(trashQuery.isLoading || !purged) && <p className="admin-status">Carregando...</p>}

      {purged && !trashQuery.isLoading && items.length === 0 && (
        <p className="library-empty">Nada na lixeira por aqui.</p>
      )}

      {items.length > 0 && (
        <ul className="trash-list">
          {items.map((item) => {
            const daysLeft = TRASH_RETENTION_DAYS - daysSince(item.deletedAt);
            return (
              <li key={`${item.kind}-${item.id}`} className="trash-item">
                <div className="trash-item-info">
                  <ClipboardList size={16} />
                  <div>
                    <span className="trash-item-name">{item.label}</span>
                    {item.detail && <span className="trash-item-detail">{item.detail}</span>}
                    <span className="trash-item-expiry">
                      Expira em {Math.max(daysLeft, 0)} dia{daysLeft === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
                <div className="trash-item-actions">
                  <button type="button" className="btn-ghost" onClick={() => handleRestore(item)}>
                    <RotateCcw size={14} />
                    Restaurar
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label={`Excluir "${item.label}" definitivamente`}
                    onClick={() => handleHardDelete(item)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
