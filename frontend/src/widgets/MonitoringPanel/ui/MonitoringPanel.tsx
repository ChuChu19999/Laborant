import { MonitoringCleanupConfirmModal } from '@/features/MonitoringCleanupConfirmModal';
import { MonitoringErrorDetailsModal } from '@/features/MonitoringErrorDetailsModal';
import { MonitoringErrorStatusModal } from '@/features/MonitoringErrorStatusModal';
import {
  getMonitoringOptionLabel,
  MonitoringErrorsTable,
  type MonitoringErrorItem,
  type MonitoringPeriod,
} from '@/entities/Monitoring';
import { APP_VERSION } from '@/shared/config';
import { formatNumberForDisplay } from '@/shared/lib/formatting';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/FormItems';
import { Layout } from '@/shared/ui/Layout';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import { ResetFiltersButton } from '@/shared/ui/ResetFiltersButton';
import { useMonitoringPanel } from '../model/useMonitoringPanel';
import './MonitoringPanel.css';

const MonitoringPanel = () => {
  const panel = useMonitoringPanel();
  const overview = panel.overviewQuery.data;
  const presence = overview?.presence;
  const hasNewErrors = (overview?.new_errors_count ?? 0) > 0;
  const apiVersion = overview?.app_version ?? '—';
  const healthStatus = overview?.health_status ?? 'ok';
  const healthLabel = getMonitoringOptionLabel(overview?.health_options ?? [], healthStatus);
  const periodLabel =
    panel.periodOptions.find(option => option.value === panel.period)?.label ?? panel.period;
  const healthDotClass =
    healthStatus === 'ok'
      ? 'monitoring-health-dot--ok'
      : healthStatus === 'degraded'
        ? 'monitoring-health-dot--warn'
        : 'monitoring-health-dot--bad';
  const latencyText =
    overview?.db_latency_ms != null ? `${formatNumberForDisplay(overview.db_latency_ms)} мс` : '—';

  return (
    <Layout title="Мониторинг">
      <NavigationBar breadcrumbs={panel.breadcrumbs} onBack={panel.navigateHome} showBack />

      <LoadingCard loading={panel.overviewQuery.isLoading} />

      <div className="monitoring-page-container">
        <div className="monitoring-page-panel">
          <aside className="monitoring-page-sidebar">
            {overview && (
              <section className="monitoring-overview">
                <div className="monitoring-overview-period">
                  <span className="monitoring-overview-period-label">Период</span>
                  <Select
                    className="monitoring-period-select"
                    value={panel.period}
                    options={panel.periodOptions}
                    disabled={panel.periodOptions.length === 0}
                    onChange={value => panel.handlePeriodChange(value as MonitoringPeriod)}
                  />
                </div>

                <div className="monitoring-overview-presence">
                  <div className="monitoring-overview-section-title">Активность</div>
                  <div className="monitoring-page-stats">
                    <div className="monitoring-stat-card monitoring-stat-card--online">
                      <div className="monitoring-stat-label">Онлайн всего</div>
                      <div className="monitoring-stat-value">{presence?.total ?? 0}</div>
                    </div>
                    <div className="monitoring-stat-card monitoring-stat-card--laborant">
                      <div className="monitoring-stat-label">Лаборанты</div>
                      <div className="monitoring-stat-value">{presence?.laborant ?? 0}</div>
                    </div>
                    <div className="monitoring-stat-card monitoring-stat-card--engineer">
                      <div className="monitoring-stat-label">Инженеры</div>
                      <div className="monitoring-stat-value">{presence?.engineer ?? 0}</div>
                    </div>
                    <div className="monitoring-stat-card monitoring-stat-card--admin">
                      <div className="monitoring-stat-label">Администраторы</div>
                      <div className="monitoring-stat-value">{presence?.admin ?? 0}</div>
                    </div>
                  </div>
                </div>

                <div className="monitoring-overview-health">
                  <div className="monitoring-overview-section-title">Состояние</div>
                  <div className="monitoring-page-stats monitoring-page-stats--compact">
                    <div
                      className={`monitoring-stat-card monitoring-stat-card--errors${
                        hasNewErrors ? ' monitoring-stat-card--alert' : ''
                      }`}
                    >
                      <div className="monitoring-stat-label">Новые ошибки ({periodLabel})</div>
                      <div className="monitoring-stat-value">{overview.new_errors_count}</div>
                    </div>
                    <div className="monitoring-stat-card monitoring-stat-card--health">
                      <div className="monitoring-stat-label">Статус работоспособности сервиса</div>
                      <div className="monitoring-health-status">
                        <span className={`monitoring-health-dot ${healthDotClass}`} />
                        <span className="monitoring-health-text">{healthLabel}</span>
                      </div>
                      <div className="monitoring-health-detail">PostgreSQL · {latencyText}</div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {overview && (
              <div className="monitoring-version-bar">
                Сервер {apiVersion} · Клиент {APP_VERSION}
              </div>
            )}

            {presence && presence.online_users.length > 0 && (
              <div className="monitoring-page-online">
                <div className="monitoring-page-online-title">Сейчас в системе</div>
                <div className="monitoring-page-online-list">
                  {presence.online_users.map(user => (
                    <span
                      key={`${user.full_name}-${user.last_seen_at}`}
                      className="monitoring-online-chip"
                    >
                      <span className="monitoring-online-chip-main">
                        {user.full_name} ·{' '}
                        {getMonitoringOptionLabel(
                          overview?.presence_options ?? [],
                          user.presence_category
                        )}
                      </span>
                      {user.current_path && (
                        <span className="monitoring-online-chip-path">{user.current_path}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <section className="monitoring-page-main">
            <div className="monitoring-page-header">
              <div className="monitoring-page-header-title">Журнал ошибок</div>
              <div className="monitoring-page-header-right">
                <Button
                  type="default"
                  loading={panel.cleanupMutation.isPending}
                  onClick={panel.modals.handleCleanupClosed}
                >
                  Очистить закрытые {'>'}90 дней
                </Button>
                <ResetFiltersButton onReset={panel.handleResetFilters} />
              </div>
            </div>

            <div className="monitoring-page-table">
              <MonitoringErrorsTable
                key={panel.tableKey}
                embedded
                data={panel.monitoring.data}
                loading={panel.monitoring.isLoading}
                pagination={panel.pagination}
                totalPages={panel.totalPages}
                totalRecords={panel.monitoring.total}
                onPaginationChange={panel.handlePaginationChange}
                onFiltersChange={panel.handleFiltersChange}
                onSortingChange={panel.handleSortingChange}
                sorting={panel.tableSorting}
                onDetails={(item: MonitoringErrorItem) => panel.modals.openDetails(item.id)}
                onStatusChange={panel.modals.requestStatusChange}
                statusPendingErrorId={
                  panel.statusMutation.isPending
                    ? panel.statusMutation.variables?.errorId
                    : undefined
                }
                severityFilterOptions={overview?.severity_options}
                sourceFilterOptions={overview?.source_options}
                resolvedFilterOptions={overview?.resolved_options}
                initialColumnFilters={panel.initialColumnFilters}
              />
            </div>
          </section>
        </div>
      </div>

      {panel.modals.cleanupConfirmOpen && (
        <MonitoringCleanupConfirmModal
          open
          loading={panel.cleanupMutation.isPending}
          onCancel={panel.modals.cancelCleanupClosed}
          onConfirm={panel.confirmCleanupClosed}
        />
      )}

      {panel.modals.statusAction && (
        <MonitoringErrorStatusModal
          open
          resolved={panel.modals.statusAction.resolved}
          loading={panel.statusMutation.isPending}
          onCancel={panel.modals.cancelStatusChange}
          onConfirm={panel.confirmStatusChange}
        />
      )}

      <MonitoringErrorDetailsModal
        open={panel.selectedError != null}
        error={panel.selectedError}
        severityOptions={overview?.severity_options ?? []}
        sourceOptions={overview?.source_options ?? []}
        onClose={panel.modals.closeDetails}
        onStatusChange={panel.modals.requestStatusChange}
      />
    </Layout>
  );
};

export default MonitoringPanel;
