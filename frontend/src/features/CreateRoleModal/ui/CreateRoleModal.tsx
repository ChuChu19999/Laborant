import { RoleFormFields } from '@/entities/Role';
import { Modal } from '@/shared/ui/Modal';
import { useCreateRoleModal } from '../model/useCreateRoleModal';

interface CreateRoleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateRoleModal = ({ open, onClose, onSuccess }: CreateRoleModalProps) => {
  const modal = useCreateRoleModal({ open, onClose, onSuccess });

  if (!open) {
    return null;
  }

  return (
    <Modal
      header="Добавление роли"
      onClose={onClose}
      onCancel={modal.handleCancel}
      onSave={modal.handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="550"
    >
      <RoleFormFields
        value={modal.formData}
        onChange={modal.handleFieldChange}
        errors={modal.errors}
      />
    </Modal>
  );
};

export default CreateRoleModal;
