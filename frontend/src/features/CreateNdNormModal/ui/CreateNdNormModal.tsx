import { NdNormFormFields } from '@/entities/NdNorm';
import { Modal } from '@/shared/ui/Modal';
import { useCreateNdNormModal } from '../model/useCreateNdNormModal';
import type { ResearchMethodDisplayItem } from '@/entities/ResearchMethod';

interface CreateNdNormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  laboratoryId?: number;
  departmentId?: number;
  methods: ResearchMethodDisplayItem[];
  isLoadingMethods?: boolean;
}

const CreateNdNormModal = ({
  open,
  onClose,
  onSuccess,
  laboratoryId,
  departmentId,
  methods,
  isLoadingMethods = false,
}: CreateNdNormModalProps) => {
  const modal = useCreateNdNormModal({
    open,
    onClose,
    onSuccess,
    laboratoryId,
    departmentId,
    methods,
  });

  if (!open) {
    return null;
  }

  return (
    <Modal
      header="Добавление нормы НД"
      onClose={onClose}
      onCancel={modal.handleCancel}
      onSave={modal.handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="550"
    >
      <NdNormFormFields
        value={modal.formData}
        onChange={modal.handleChange}
        errors={modal.errors}
        testObjectOptions={modal.testObjectOptions}
        methods={methods}
        methodsLoading={isLoadingMethods}
      />
    </Modal>
  );
};

export default CreateNdNormModal;
