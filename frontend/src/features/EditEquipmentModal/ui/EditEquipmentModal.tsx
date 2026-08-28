import { EquipmentFormFields } from '@/entities/Equipment';
import { Modal } from '@/shared/ui/Modal';
import { useEditEquipmentModal } from '../model/useEditEquipmentModal';
import type { Equipment } from '@/entities/Equipment';

interface EditEquipmentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  equipment: Equipment;
  laboratoryId?: number;
  departmentId?: number;
}

const EditEquipmentModal = ({
  open,
  onClose,
  onSuccess,
  equipment,
  laboratoryId,
  departmentId,
}: EditEquipmentModalProps) => {
  const modal = useEditEquipmentModal({
    open,
    onClose,
    onSuccess,
    equipment,
    laboratoryId,
    departmentId,
  });

  if (!open || !equipment) {
    return null;
  }

  return (
    <Modal
      header="Редактирование прибора"
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

export default EditEquipmentModal;
