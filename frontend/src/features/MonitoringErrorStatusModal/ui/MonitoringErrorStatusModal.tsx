import { useEffect, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { InputText } from '@/shared/ui/FormItems';
import { Modal } from '@/shared/ui/Modal';
import './MonitoringErrorStatusModal.css';

interface MonitoringErrorStatusModalProps {
  open: boolean;
  resolved: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (comment: string) => void;
}

const MonitoringErrorStatusModal = ({
  open,
  resolved,
  loading = false,
  onCancel,
  onConfirm,
}: MonitoringErrorStatusModalProps) => {
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (open) {
      setComment('');
    }
  }, [open, resolved]);

  if (!open) {
    return null;
  }

  const header = resolved ? 'Закрыть' : 'Открыть снова';
  const placeholder = resolved
    ? 'Примечание (необязательно)'
    : 'Почему открываете снова (необязательно)';
  const confirmText = resolved ? 'Закрыть' : 'Открыть';

  return (
    <Modal
      header={header}
      onClose={onCancel}
      onCancel={onCancel}
      cancelText="Отмена"
      showEditButton={false}
      editable={false}
      modalWidth="450"
      extraButtons={
        <Button type="primary" loading={loading} onClick={() => onConfirm(comment)}>
          {confirmText}
        </Button>
      }
    >
      <div className="monitoring-error-status-modal">
        <InputText
          rows={2}
          maxLength={500}
          placeholder={placeholder}
          value={comment}
          onChange={event => setComment(event.target.value)}
        />
      </div>
    </Modal>
  );
};

export default MonitoringErrorStatusModal;
