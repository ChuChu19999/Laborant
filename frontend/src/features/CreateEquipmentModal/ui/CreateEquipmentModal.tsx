import { EquipmentFormFields } from '@/entities/Equipment';
import { Modal } from '@/shared/ui/Modal';
import { useCreateEquipmentModal } from '../model/useCreateEquipmentModal';

interface CreateEquipmentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  laboratoryId?: number;
  departmentId?: number;
}

const CreateEquipmentModal = ({
  open,
  onClose,
  onSuccess,
  laboratoryId,
  departmentId,
}: CreateEquipmentModalProps) => {
  const modal = useCreateEquipmentModal({
    open,
    onClose,
    onSuccess,
    laboratoryId,
    departmentId,
  });

  if (!open) {
    return null;
  }

  return (
    <Modal
      header="Добавление прибора"
      onClose={onClose}
      onCancel={modal.handleCancel}
      onSave={modal.handleSave}
      modalWidth="550"
    >
      <EquipmentFormFields
        value={modal.formData}
        onChange={modal.handleFieldChange}
        errors={modal.errors}
        methods={modal.methods}
        methodsLoading={modal.isLoadingMethods}
      />
    </Modal>
  );
};

export default CreateEquipmentModal;
