import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, PencilLine, Trash2 } from 'lucide-react';
import { deleteBodyReport, fetchBodyReports } from './bodyReportApi';
import { formatShortDate as formatDate } from '../../lib/date';
import './BodyReportPage.css';

export function BodyReportPage() {
  const queryClient = useQueryClient();
  const reportsQuery = useQuery({ queryKey: ['admin-body-reports'], queryFn: fetchBodyReports });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin-body-reports'] });
    queryClient.invalidateQueries({ queryKey: ['body-progress'] });
  }

  const deleteMutation = useMutation({ mutationFn: deleteBodyReport, onSuccess: invalidate });

  const reports = reportsQuery.data ?? [];

  return (
    <div className="admin-section reports-page">
      <span className="reports-eyebrow">Composição corporal</span>
      <h2 className="section-title">Meus Relatórios</h2>
      <p className="import-hint">
        Relatórios criados em "Criar Relatório" ou importados via JSON aparecem todos aqui.
      </p>

      {reportsQuery.isLoading && <p className="admin-status">Carregando...</p>}

      {!reportsQuery.isLoading && reports.length === 0 && (
        <p className="library-empty">
          Nenhum relatório ainda. Crie um em "Criar Relatório" ou importe um JSON.
        </p>
      )}

      <ul className="reports-list">
        {reports.map((report) => (
          <li key={report.id} className="report-card">
            <div className="report-card-info">
              <span className="report-card-date">
                <ClipboardList size={16} />
                {formatDate(report.measured_at)}
              </span>
              <div className="report-card-stats">
                {report.metrics.peso_kg != null && (
                  <span className="report-card-stat">
                    Peso <strong>{report.metrics.peso_kg} kg</strong>
                  </span>
                )}
                {report.metrics.imc != null && (
                  <span className="report-card-stat">
                    IMC <strong>{report.metrics.imc}</strong>
                  </span>
                )}
                {report.metrics.gordura_corporal_pct != null && (
                  <span className="report-card-stat">
                    Gordura <strong>{report.metrics.gordura_corporal_pct}%</strong>
                  </span>
                )}
              </div>
            </div>
            <div className="report-card-actions">
              <Link
                to={`/admin/body-report/create?id=${report.id}`}
                className="btn-icon neutral"
                aria-label={`Editar relatório de ${formatDate(report.measured_at)}`}
              >
                <PencilLine size={15} />
              </Link>
              <button
                type="button"
                className="btn-icon"
                aria-label={`Remover relatório de ${formatDate(report.measured_at)}`}
                onClick={() => deleteMutation.mutate(report.id)}
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
