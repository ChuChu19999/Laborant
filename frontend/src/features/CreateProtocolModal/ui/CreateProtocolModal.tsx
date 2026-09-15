import { ProtocolFormFields } from '@/entities/Protocol';
import { Modal } from '@/shared/ui/Modal';
import { useCreateProtocolModal } from '../model/useCreateProtocolModal';

interface CreateProtocolModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  laboratoryId?: number;
  departmentId?: number;
}

const CreateProtocolModal = ({
  open,
  onClose,
  onSuccess,
  laboratoryId,
  departmentId,
}: CreateProtocolModalProps) => {
  const modal = useCreateProtocolModal({
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
      header="Добавление протокола"
      onClose={onClose}
      onCancel={modal.handleCancel}
      onSave={modal.handleSave}
      modalWidth="550"
    >
      <ProtocolFormFields
        value={modal.formData}
        onChange={modal.handleFieldChange}
        errors={modal.errors}
        canShow={modal.canShow}
        laboratoryName={modal.laboratoryName}
        templates={modal.templateOptions}
        templatesLoading={modal.templatesLoading}
        samples={modal.samples}
        samplesLoading={modal.samplesLoading}
      />
    </Modal>
  );
};

export default CreateProtocolModal;
