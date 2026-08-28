import { useDeleteProtocol } from '@/entities/Protocol';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import type { Protocol } from '@/entities/Protocol';

interface DeleteProtocolModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  protocol: Protocol | null;
}

const DeleteProtocolModal = ({ open, onClose, onSuccess, protocol }: DeleteProtocolModalProps) => {
  const deleteProtocolMutation = useDeleteProtocol();

  const handleConfirm = async () => {
    if (protocol) {
      await deleteProtocolMutation.mutateAsync(protocol.id);
      onSuccess();
    }
  };

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
