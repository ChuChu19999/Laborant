import dayjs from 'dayjs';
import {
  getMonitoringOptionLabel,
  type MonitoringErrorItem,
  type MonitoringOption,
} from '@/entities/Monitoring';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import './MonitoringErrorDetailsModal.css';

interface MonitoringErrorDetailsModalProps {
  open: boolean;
  error: MonitoringErrorItem | null;
  severityOptions: MonitoringOption[];
  sourceOptions: MonitoringOption[];
  onClose: () => void;
  onStatusChange: (errorId: number, resolved: boolean) => void;
}

const MonitoringErrorDetailsModal = ({
  open,
  error,
  severityOptions,
  sourceOptions,
  onClose,
  onStatusChange,
}: MonitoringErrorDetailsModalProps) => {
  if (!open || !error) {
    return null;
  }

  return (
    <Modal
      header="Детали ошибки"
      onClose={onClose}
      onCancel={onClose}
      cancelText="Закрыть окно"
      showEditButton={false}
      editable={false}
      modalWidth="550"
      extraButtons={
        <Button type="primary" onClick={() => onStatusChange(error.id, !error.resolved_at)}>
          {error.resolved_at ? 'Открыть снова' : 'Закрыть ошибку'}
        </Button>
      }
    >
      <div className="monitoring-error-details">
        <dl className="monitoring-error-details-meta">
          <div className="monitoring-error-details-item">
            <dt>Уровень</dt>
            <dd>
              <span
                className={`monitoring-error-detail-badge monitoring-error-detail-badge--${error.severity}`}
              >
                {getMonitoringOptionLabel(severityOptions, error.severity)}
              </span>
            </dd>
          </div>
          <div className="monitoring-error-details-item">
            <dt>Источник</dt>
            <dd>{getMonitoringOptionLabel(sourceOptions, error.source)}</dd>
          </div>
          {error.path && (
            <div className="monitoring-error-details-item monitoring-error-details-item--wide">
              <dt>Путь</dt>
              <dd className="monitoring-error-details-path">{error.path}</dd>
            </div>
          )}
          {error.app_version && (
            <div className="monitoring-error-details-item">
              <dt>Версия</dt>
              <dd>{error.app_version}</dd>
            </div>
          )}
          {error.reporter_name && (
            <div className="monitoring-error-details-item">
              <dt>Пользователь</dt>
              <dd>{error.reporter_name}</dd>
            </div>
          )}
          {error.browser && (
            <div className="monitoring-error-details-item">
              <dt>Браузер</dt>
              <dd>{error.browser}</dd>
            </div>
          )}
          {error.exception_type && (
            <div className="monitoring-error-details-item">
              <dt>Тип</dt>
              <dd>{error.exception_type}</dd>
            </div>
          )}
          <div className="monitoring-error-details-item">
            <dt>Повторы</dt>
            <dd>{error.occurrence_count}</dd>
          </div>
          <div className="monitoring-error-details-item">
            <dt>Статус</dt>
            <dd>
              {error.resolved_at ? (
                <span className="monitoring-error-detail-status monitoring-error-detail-status--resolved">
                  Закрыта
                </span>
              ) : (
                <span className="monitoring-error-detail-status monitoring-error-detail-status--open">
                  Открыта
                </span>
              )}
            </dd>
          </div>
          <div className="monitoring-error-details-item">
            <dt>Первое появление</dt>
            <dd>{dayjs(error.first_seen_at).format('DD.MM.YYYY HH:mm:ss')}</dd>
          </div>
          <div className="monitoring-error-details-item">
            <dt>Последнее появление</dt>
            <dd>{dayjs(error.last_seen_at).format('DD.MM.YYYY HH:mm:ss')}</dd>
          </div>
          {error.resolved_by_name && (
            <div className="monitoring-error-details-item">
              <dt>Закрыл</dt>
              <dd>{error.resolved_by_name}</dd>
            </div>
          )}
          {error.resolve_comment && (
            <div className="monitoring-error-details-item monitoring-error-details-item--wide">
              <dt>Примечание</dt>
              <dd className="monitoring-error-details-note">{error.resolve_comment}</dd>
            </div>
          )}
        </dl>

        <div className="monitoring-error-details-block">
          <div className="monitoring-error-details-block-title">Сообщение</div>
          <div className="monitoring-error-details-message">{error.message}</div>
        </div>

        {error.stack_trace && (
          <div className="monitoring-error-details-block">
            <div className="monitoring-error-details-block-title">Стек</div>
            <pre className="monitoring-error-stack">{error.stack_trace}</pre>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default MonitoringErrorDetailsModal;
