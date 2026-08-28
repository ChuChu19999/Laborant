import { LaboratoryFormFields } from '@/entities/Laboratory';
import { Modal } from '@/shared/ui/Modal';
import { useCreateLaboratoryModal } from '../model/useCreateLaboratoryModal';

interface CreateLaboratoryModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateLaboratoryModal = ({ open, onClose, onSuccess }: CreateLaboratoryModalProps) => {
  const modal = useCreateLaboratoryModal({ open, onClose, onSuccess });

  if (!open) {
    return null;
  }

  return (
    <Modal
      header="Добавление лаборатории"
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

export default CreateLaboratoryModal;
