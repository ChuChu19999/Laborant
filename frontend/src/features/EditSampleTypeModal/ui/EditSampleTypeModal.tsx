import { SampleTypeFormFields } from '@/entities/SampleType';
import { Modal } from '@/shared/ui/Modal';
import { useEditSampleTypeModal } from '../model/useEditSampleTypeModal';
import type { SampleType } from '@/entities/SampleType';

interface EditSampleTypeModalProps {
  open: boolean;
  sampleType: SampleType | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const EditSampleTypeModal = ({
  open,
  sampleType,
  onClose,
  onSuccess,
}: EditSampleTypeModalProps) => {
  const modal = useEditSampleTypeModal({ open, sampleType, onClose, onSuccess });

  if (!open || !sampleType) {
    return null;
  }

  return (
    <Modal
      header="Редактирование типа пробы"
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

export default EditSampleTypeModal;
