import { SampleFormFields } from '@/entities/Sample';
import { Modal } from '@/shared/ui/Modal';
import { useCreateSampleModal } from '../model/useCreateSampleModal';

interface CreateSampleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  laboratoryId?: number;
  departmentId?: number;
}

const CreateSampleModal = ({
  open,
  onClose,
  onSuccess,
  laboratoryId,
  departmentId,
}: CreateSampleModalProps) => {
  const modal = useCreateSampleModal({
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
      header="Добавление пробы"
      onClose={onClose}
      onCancel={modal.handleCancel}
      onSave={modal.handleSave}
      modalWidth="550"
    >
      <SampleFormFields
        value={modal.formData}
        onChange={modal.handleFieldChange}
        errors={modal.errors}
        canShow={modal.canShow}
        terminologyLabel={modal.terminologyLabel}
        sampleTypes={modal.sampleTypes}
        testObjectOptions={modal.testObjectOptions}
        branchOptions={modal.branchOptions}
        branchesLoading={modal.branchesLoading}
        samplingLocationOptions={modal.samplingLocationOptions}
        locationsLoading={modal.locationsLoading}
        wellModeOptions={modal.wellModeOptions}
        wellModesLoading={modal.wellModesLoading}
        addedBy={modal.addedBy}
        onAddedByChange={modal.handleAddedByChange}
        laboratoryName={modal.laboratoryName}
        selectionConditionsFields={modal.selectionConditionsFields}
        selectionConditions={modal.selectionConditions}
        onSelectionConditionChange={modal.handleSelectionConditionChange}
      />
    </Modal>
  );
};

export default CreateSampleModal;
