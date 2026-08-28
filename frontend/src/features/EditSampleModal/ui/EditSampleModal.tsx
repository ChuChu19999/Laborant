import { SampleFormFields } from '@/entities/Sample';
import { Modal } from '@/shared/ui/Modal';
import { useEditSampleModal } from '../model/useEditSampleModal';
import type { Sample } from '@/entities/Sample';

interface EditSampleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sample: Sample;
  laboratoryId?: number;
  departmentId?: number;
}

const EditSampleModal = ({
  open,
  onClose,
  onSuccess,
  sample,
  laboratoryId,
  departmentId,
}: EditSampleModalProps) => {
  const modal = useEditSampleModal({
    open,
    onClose,
    onSuccess,
    sample,
    laboratoryId,
    departmentId,
  });

  if (!open) {
    return null;
  }

  return (
    <Modal
      header="Редактирование пробы"
      onClose={modal.handleCancel}
      onCancel={modal.handleCancel}
      onSave={modal.handleSubmit}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="550"
    >
      <SampleFormFields
        value={modal.formData}
        onChange={modal.handleFieldChange}
        errors={modal.errors}
        canShow={modal.canShow}
        terminologyLabel={modal.terminologyLabel}
        sampleTypes={modal.sampleTypes}
        testObjectOptions={modal.testObjectSelectOptions}
        branchOptions={modal.branchOptions}
        branchesLoading={modal.branchesLoading}
        samplingLocationOptions={modal.samplingLocationOptions}
        locationsLoading={modal.locationsLoading}
        wellModeOptions={modal.wellModeOptions}
        wellModesLoading={modal.wellModesLoading}
        addedBy={modal.addedByEmployee}
        addedByDisabled
        selectionConditionsFields={modal.selectionConditionsFields}
        selectionConditions={modal.selectionConditions}
        onSelectionConditionChange={modal.handleSelectionConditionChange}
      />
    </Modal>
  );
};

export default EditSampleModal;
