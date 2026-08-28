import { RoleFormFields } from '@/entities/Role';
import { Modal } from '@/shared/ui/Modal';
import { useEditRoleModal } from '../model/useEditRoleModal';
import type { RoleCatalogItem } from '@/entities/Role';

interface EditRoleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  role: RoleCatalogItem | null;
}

const EditRoleModal = ({ open, onClose, onSuccess, role }: EditRoleModalProps) => {
  const modal = useEditRoleModal({ open, onClose, onSuccess, role });

  if (!open || !role) {
    return null;
  }

  return (
    <Modal
      header="Редактирование роли"
      onClose={modal.handleCancel}
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

export default EditRoleModal;
