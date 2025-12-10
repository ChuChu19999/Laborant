import React from 'react';
import { Modal } from '../../../shared/ui/Modal';
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
  style?: React.CSSProperties;
  modalWidth?: '450' | '550' | '1000';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  open,
  title = 'Подтверждение',
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  onConfirm,
  onCancel,
  confirmButtonColor,
  style,
  modalWidth,
}) => {
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
      style={style}
      modalWidth={modalWidth}
    >
      <p className="confirmation-modal-message">{message}</p>
    </Modal>
  );
};

export default ConfirmationModal;
