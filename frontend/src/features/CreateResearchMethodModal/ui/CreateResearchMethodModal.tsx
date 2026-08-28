import { Modal } from '@/shared/ui/Modal';
import { PrimarySpinIndicator, Spin } from '@/shared/ui/Spin';
import { useCreateResearchMethodModal } from '../model/useCreateResearchMethodModal';
import { ResearchMethodFixturePrefill } from './ResearchMethodFixturePrefill';
import { ResearchMethodGroupForm } from './ResearchMethodGroupForm';
import { ResearchMethodModalTabs } from './ResearchMethodModalTabs';
import { ResearchMethodSingleForm } from './ResearchMethodSingleForm';
import type { ResearchMethod, ResearchMethodGroup } from '@/entities/ResearchMethod';
import './CreateResearchMethodModal.css';

interface CreateResearchMethodModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (method: ResearchMethod | ResearchMethodGroup) => void;
  laboratoryId?: number;
  departmentId?: number;
  laboratoryName?: string;
  departmentName?: string;
  /** Режим редактирования: ID метода для загрузки и замены (старый помечается удалённым, создаётся новая запись). */
  editMethodId?: number;
}

const CreateResearchMethodModal = ({
  open,
  onClose,
  onSuccess,
  laboratoryId,
  departmentId,
  laboratoryName,
  editMethodId,
}: CreateResearchMethodModalProps) => {
  const modal = useCreateResearchMethodModal({
    open,
    onClose,
    onSuccess,
    laboratoryId,
    departmentId,
    laboratoryName,
    editMethodId,
  });
  const spinnerIndicator = <PrimarySpinIndicator />;

  if (!open) return null;

  return (
    <Modal
      header={
        modal.isEditMode ? 'Редактирование метода исследования' : 'Добавление метода исследования'
      }
      onClose={onClose}
      onCancel={onClose}
      onSave={modal.handleSubmit}
      modalWidth="1000"
      saveButtonText="Сохранить"
    >
      <div className="create-research-method-modal">
        {!modal.isEditMode && (
          <ResearchMethodModalTabs
            activeTab={modal.activeTab}
            onTabChange={modal.handleTabChange}
          />
        )}

        {modal.showSingleForm && !modal.isEditMode && (
          <ResearchMethodFixturePrefill
            isLoadingFixtures={modal.isLoadingFixtures}
            fixtureTreeData={modal.fixtureTreeData}
            selectedFixture={modal.selectedFixture}
            spinnerIndicator={spinnerIndicator}
            loadData={modal.loadFixtureFilesForDirectory}
            onSelect={value => {
              void modal.applyTemplateSelection(value);
            }}
          />
        )}

        <div
          className={`modal-content-wrapper ${modal.isEditMode || modal.activeTab === 'single' ? 'single-content' : 'group-content'}`}
        >
          <div
            className={`create-research-method-tab-content ${modal.isAnimating ? 'entering' : ''}`}
          >
            {modal.isEditMode && modal.isLoadingMethod ? (
              <div className="create-research-method-modal-spinner">
                <Spin tip="Загрузка метода..." indicator={spinnerIndicator} spinning>
                  <div className="create-research-method-modal-spinner-placeholder" />
                </Spin>
              </div>
            ) : modal.activeTab === 'group' && !modal.isEditMode ? (
              <ResearchMethodGroupForm
                groupData={modal.groupData}
                availableMethods={modal.availableMethods}
                isLoadingMethods={modal.isLoadingMethods}
                spinnerIndicator={spinnerIndicator}
                onGroupDataChange={modal.handleGroupDataChange}
                onNameChange={name => modal.setGroupData(prev => ({ ...prev, name }))}
              />
            ) : (
              <ResearchMethodSingleForm
                formData={modal.formData}
                setFormData={modal.setFormData}
                sampleTypeOptions={modal.sampleTypeOptions}
                sampleTypesLoading={modal.isSampleTypeOptionsLoading}
                formulaEditor={modal.formulaEditor}
                onSampleTypeChange={modal.handleSampleTypeChange}
                onInputChange={modal.handleInputChange}
                onInputDataChange={modal.handleInputDataChange}
                onDeleteInputField={modal.deleteInputField}
                onAddInputField={modal.addInputField}
                onIntermediateDataChange={modal.handleIntermediateDataChange}
                onDeleteIntermediateField={modal.deleteIntermediateField}
                onAddIntermediateField={modal.addIntermediateField}
                onRangeChange={modal.handleIntermediateRangeChange}
                onAddRange={modal.addIntermediateRange}
                onDeleteRange={modal.deleteIntermediateRange}
                getRoundingMode={modal.getIntermediateRoundingMode}
                onRoundingModeChange={modal.applyIntermediateRoundingMode}
                onConvergenceChange={modal.handleConvergenceChange}
                onAddConvergenceCondition={modal.addConvergenceCondition}
                onDeleteConvergenceCondition={modal.deleteConvergenceCondition}
                onMeasurementErrorTypeChange={modal.handleMeasurementErrorTypeChange}
                onMeasurementErrorValueChange={modal.handleMeasurementErrorValueChange}
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CreateResearchMethodModal;
