import React, { useCallback } from 'react';
import { ConfirmationModal } from '../../../../entities/ConfirmationModal';
import { useDeleteProtocol } from '../../../../shared/model/hooks';
import type { Protocol } from '../../../../shared/api/protocols';

interface DeleteProtocolModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  protocol: Protocol | null;
}

const DeleteProtocolModal: React.FC<DeleteProtocolModalProps> = ({
  open,
  onClose,
  onSuccess,
  protocol,
}) => {
  const deleteProtocolMutation = useDeleteProtocol();

  const handleConfirm = useCallback(async () => {
    if (protocol) {
      await deleteProtocolMutation.mutateAsync(protocol.id);
      onSuccess();
    }
  }, [protocol, deleteProtocolMutation, onSuccess]);

  if (!protocol) {
    return null;
  }

  const protocolNumber = protocol.test_protocol_number || 'без номера';

  return (
    <ConfirmationModal
      open={open}
      title="Удаление протокола"
      message={`Вы действительно хотите удалить протокол №${protocolNumber}?`}
      confirmText="Подтвердить"
      cancelText="Отмена"
      onConfirm={handleConfirm}
      onCancel={onClose}
      modalWidth="450"
    />
  );
};

export default DeleteProtocolModal;
