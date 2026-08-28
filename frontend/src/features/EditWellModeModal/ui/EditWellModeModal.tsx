import { WellModeFormFields } from '@/entities/WellMode';
import { Modal } from '@/shared/ui/Modal';
import { useEditWellModeModal } from '../model/useEditWellModeModal';
import type { WellMode } from '@/entities/WellMode';

interface EditWellModeModalProps {
  open: boolean;
  wellMode: WellMode | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const EditWellModeModal = ({ open, wellMode, onClose, onSuccess }: EditWellModeModalProps) => {
  const modal = useEditWellModeModal({ open, wellMode, onClose, onSuccess });

  if (!open || !wellMode) {
    return null;
  }

  return (
    <Modal
      header="Редактирование режима скважины"
      onClose={modal.handleClose}
      onCancel={modal.handleClose}
      onSave={modal.handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="550"
    >
      <WellModeFormFields
        value={modal.formData}
        onChange={modal.handleFieldChange}
        errors={modal.errors}
      />
    </Modal>
  );
};

export default EditWellModeModal;
