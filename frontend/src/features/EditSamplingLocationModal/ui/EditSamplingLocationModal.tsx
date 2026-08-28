import { SamplingLocationFormFields } from '@/entities/SamplingLocation';
import { Modal } from '@/shared/ui/Modal';
import { useEditSamplingLocationModal } from '../model/useEditSamplingLocationModal';
import type { SamplingLocation } from '@/entities/SamplingLocation';

interface EditSamplingLocationModalProps {
  open: boolean;
  location: SamplingLocation | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const EditSamplingLocationModal = ({
  open,
  location,
  onClose,
  onSuccess,
}: EditSamplingLocationModalProps) => {
  const modal = useEditSamplingLocationModal({ open, location, onClose, onSuccess });

  if (!open || !location) {
    return null;
  }

  return (
    <Modal
      header="Редактирование места отбора пробы"
      onClose={modal.handleClose}
      onCancel={modal.handleClose}
      onSave={modal.handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="550"
    >
      <SamplingLocationFormFields
        value={modal.formData}
        onChange={modal.handleFieldChange}
        errors={modal.errors}
      />
    </Modal>
  );
};

export default EditSamplingLocationModal;
