import { SamplingLocationFormFields } from '@/entities/SamplingLocation';
import { Modal } from '@/shared/ui/Modal';
import { useCreateSamplingLocationModal } from '../model/useCreateSamplingLocationModal';

interface CreateSamplingLocationModalProps {
  open: boolean;
  branchId: number;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateSamplingLocationModal = ({
  open,
  branchId,
  onClose,
  onSuccess,
}: CreateSamplingLocationModalProps) => {
  const modal = useCreateSamplingLocationModal({
    open,
    branchId,
    onClose,
    onSuccess,
  });

  if (!open) {
    return null;
  }

  return (
    <Modal
      header="Добавление места отбора пробы"
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

export default CreateSamplingLocationModal;
