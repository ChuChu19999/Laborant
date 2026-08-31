import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import './MonitoringCleanupConfirmModal.css';

interface MonitoringCleanupConfirmModalProps {
  open: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const MonitoringCleanupConfirmModal = ({
  open,
  loading = false,
  onCancel,
  onConfirm,
}: MonitoringCleanupConfirmModalProps) => {
  if (!open) {
    return null;
  }

  return (
    <Modal
      header="Очистить закрытые ошибки?"
      onClose={onCancel}
      onCancel={onCancel}
      cancelText="Отмена"
      showEditButton={false}
      editable={false}
      modalWidth="450"
      extraButtons={
        <Button type="primary" loading={loading} onClick={onConfirm}>
          Очистить
        </Button>
      }
    >
      <p className="monitoring-cleanup-confirm-text">
        Будут удалены ошибки, закрытые более 90 дней назад. Действие необратимо.
      </p>
    </Modal>
  );
};

export default MonitoringCleanupConfirmModal;
