import { SampleTypeFormFields } from '@/entities/SampleType';
import { Modal } from '@/shared/ui/Modal';
import { useCreateSampleTypeModal } from '../model/useCreateSampleTypeModal';

interface CreateSampleTypeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  laboratoryId?: number;
  departmentId?: number;
}

const CreateSampleTypeModal = ({
  open,
  onClose,
  onSuccess,
  laboratoryId,
  departmentId,
}: CreateSampleTypeModalProps) => {
  const modal = useCreateSampleTypeModal({
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
      header="Добавление типа пробы"
      onClose={modal.handleClose}
      onCancel={modal.handleClose}
      onSave={modal.handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="550"
    >
      <SampleTypeFormFields
        value={modal.formData}
        onChange={modal.handleFieldChange}
        errors={modal.errors}
      />
    </Modal>
  );
};

export default CreateSampleTypeModal;
