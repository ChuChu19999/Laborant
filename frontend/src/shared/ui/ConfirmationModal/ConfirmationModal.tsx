import { Modal } from '@/shared/ui/Modal';
import './ConfirmationModal.css';

interface ConfirmationModalProps {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmButtonColor?: string;
  modalWidth?: '450' | '550' | '1000' | '1800';
}

const ConfirmationModal = ({
  open,
  title = 'Подтверждение',
  message,
  confirmText = 'Сохранить',
  cancelText = 'Отмена',
  onConfirm,
  onCancel,
  confirmButtonColor,
  modalWidth,
}: ConfirmationModalProps) => {
  if (!open) return null;

  return (
    <Modal
      header={title}
      onClose={onCancel}
      onCancel={onCancel}
      cancelText={cancelText}
      onSave={onConfirm}
      saveButtonText={confirmText}
      saveButtonColor={confirmButtonColor}
      showEditButton={false}
      editable={false}
      modalWidth={modalWidth}
    >
      <p className="confirmation-modal-message">{message}</p>
    </Modal>
  );
};

export default ConfirmationModal;
