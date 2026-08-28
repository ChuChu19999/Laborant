import { LaboratoryFormFields } from '@/entities/Laboratory';
import { Modal } from '@/shared/ui/Modal';
import { useEditLaboratoryModal } from '../model/useEditLaboratoryModal';
import type { Laboratory } from '@/entities/Laboratory';

interface EditLaboratoryModalProps {
  open: boolean;
  laboratory: Laboratory | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const EditLaboratoryModal = ({
  open,
  laboratory,
  onClose,
  onSuccess,
}: EditLaboratoryModalProps) => {
  const modal = useEditLaboratoryModal({ open, laboratory, onClose, onSuccess });

  if (!open || !laboratory) {
    return null;
  }

  return (
    <Modal
      header="Редактирование лаборатории"
      onClose={modal.handleClose}
      onCancel={modal.handleClose}
      onSave={modal.handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="550"
    >
      <LaboratoryFormFields
        value={modal.formData}
        onChange={modal.handleFieldChange}
        errors={modal.errors}
      />
    </Modal>
  );
};

export default EditLaboratoryModal;
