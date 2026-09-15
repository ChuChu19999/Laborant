import { ProtocolFormFields } from '@/entities/Protocol';
import { Modal } from '@/shared/ui/Modal';
import { useEditProtocolModal } from '../model/useEditProtocolModal';
import type { Protocol } from '@/entities/Protocol';

interface EditProtocolModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  protocol: Protocol;
  laboratoryId?: number;
  departmentId?: number;
}

const EditProtocolModal = ({
  open,
  onClose,
  onSuccess,
  protocol,
  laboratoryId,
  departmentId,
}: EditProtocolModalProps) => {
  const modal = useEditProtocolModal({
    open,
    onClose,
    onSuccess,
    protocol,
    laboratoryId,
    departmentId,
  });

  if (!open) {
    return null;
  }

  return (
    <Modal
      header="Редактирование протокола"
      onClose={modal.handleCancel}
      onCancel={modal.handleCancel}
      onSave={modal.handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
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

export default EditProtocolModal;
