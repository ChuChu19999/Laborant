import { NdNormFormFields } from '@/entities/NdNorm';
import { Modal } from '@/shared/ui/Modal';
import { useEditNdNormModal } from '../model/useEditNdNormModal';
import type { NdNorm } from '@/entities/NdNorm';
import type { ResearchMethodDisplayItem } from '@/entities/ResearchMethod';

interface EditNdNormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ndNorm: NdNorm;
  methods: ResearchMethodDisplayItem[];
  isLoadingMethods?: boolean;
}

const EditNdNormModal = ({
  open,
  onClose,
  onSuccess,
  ndNorm,
  methods,
  isLoadingMethods = false,
}: EditNdNormModalProps) => {
  const modal = useEditNdNormModal({
    open,
    onClose,
    onSuccess,
    ndNorm,
    methods,
  });

  if (!open) {
    return null;
  }

  return (
    <Modal
      header="Редактирование нормы НД"
      onClose={onClose}
      onCancel={modal.handleCancel}
      onSave={modal.handleSave}
      saveButtonText="Сохранить"
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

export default EditNdNormModal;
