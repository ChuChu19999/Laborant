import React from 'react';
import { Modal } from '../../../shared/ui/Modal';

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
}) => {
  if (!open) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
        }}
      />
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
      >
        <p style={{ margin: 0 }}>{message}</p>
      </Modal>
    </>
  );
};

export default ConfirmationModal;
