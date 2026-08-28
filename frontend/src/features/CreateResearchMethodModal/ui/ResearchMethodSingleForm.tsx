import { ResearchMethodFormFields } from '@/entities/ResearchMethod';
import { ConvergenceConditionsSection } from './sections/ConvergenceConditionsSection';
import { InputDataFieldsSection } from './sections/InputDataFieldsSection';
import { IntermediateFieldsSection } from './sections/IntermediateFieldsSection';
import { MainFormulaSection } from './sections/MainFormulaSection';
import { MeasurementErrorSection } from './sections/MeasurementErrorSection';
import { RoundingSection } from './sections/RoundingSection';
import type { IntermediateFieldForm, ResearchMethodFormData } from '../lib';
import type { FormulaFieldEditor } from '../model/useFormulaFieldEditor';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';

type SampleTypeOption = { value: string; label: string };

type ResearchMethodSingleFormProps = {
  formData: ResearchMethodFormData;
  setFormData: Dispatch<SetStateAction<ResearchMethodFormData>>;
  sampleTypeOptions: SampleTypeOption[];
  sampleTypesLoading: boolean;
  formulaEditor: FormulaFieldEditor;
  onSampleTypeChange: (checkedValues: string[]) => void;
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onInputDataChange: (index: number, field: string, value: unknown) => void;
  onDeleteInputField: (index: number) => void;
  onAddInputField: () => void;
  onIntermediateDataChange: (index: number, field: string, value: unknown) => void;
  onDeleteIntermediateField: (index: number) => void;
  onAddIntermediateField: () => void;
  onRangeChange: (fieldIndex: number, rangeIndex: number, key: string, value: string) => void;
  onAddRange: (fieldIndex: number) => void;
  onDeleteRange: (fieldIndex: number, rangeIndex: number) => void;
  getRoundingMode: (field: IntermediateFieldForm) => 'result' | 'custom' | 'multiple';
  onRoundingModeChange: (index: number, mode: 'result' | 'custom' | 'multiple') => void;
  onConvergenceChange: (index: number, field: string, value: unknown) => void;
  onAddConvergenceCondition: () => void;
  onDeleteConvergenceCondition: (index: number) => void;
  onMeasurementErrorTypeChange: (type: 'fixed' | 'formula' | 'range' | 'none') => void;
  onMeasurementErrorValueChange: (value: string | ChangeEvent<HTMLInputElement>) => void;
};

export const ResearchMethodSingleForm = ({
  formData,
  setFormData,
  sampleTypeOptions,
  sampleTypesLoading,
  formulaEditor,
  onSampleTypeChange,
  onInputChange,
  onInputDataChange,
  onDeleteInputField,
  onAddInputField,
  onIntermediateDataChange,
  onDeleteIntermediateField,
  onAddIntermediateField,
  onRangeChange,
  onAddRange,
  onDeleteRange,
  getRoundingMode,
  onRoundingModeChange,
  onConvergenceChange,
  onAddConvergenceCondition,
  onDeleteConvergenceCondition,
  onMeasurementErrorTypeChange,
  onMeasurementErrorValueChange,
}: ResearchMethodSingleFormProps) => (
  <>
    <ResearchMethodFormFields
      sections={['name', 'catalog', 'sample_type']}
      value={formData}
      onChange={patch => {
        if (patch.sample_type !== undefined) {
          onSampleTypeChange(patch.sample_type);
        }
        const rest = { ...patch };
        delete rest.sample_type;
        if (Object.keys(rest).length > 0) {
          setFormData(prev => ({ ...prev, ...rest }));
        }
      }}
      sampleTypeOptions={sampleTypeOptions}
      sampleTypesLoading={sampleTypesLoading}
    />

    <InputDataFieldsSection
      formData={formData}
      onInputDataChange={onInputDataChange}
      onDeleteField={onDeleteInputField}
      onAddField={onAddInputField}
    />

    <IntermediateFieldsSection
      formData={formData}
      formulaEditor={formulaEditor}
      onIntermediateDataChange={onIntermediateDataChange}
      onDeleteField={onDeleteIntermediateField}
      onAddField={onAddIntermediateField}
      onRangeChange={onRangeChange}
      onAddRange={onAddRange}
      onDeleteRange={onDeleteRange}
      getRoundingMode={getRoundingMode}
      onRoundingModeChange={onRoundingModeChange}
    />

    <MainFormulaSection
      formula={formData.formula}
      onChange={onInputChange}
      formulaEditor={formulaEditor}
    />

    <ConvergenceConditionsSection
      formData={formData}
      formulaEditor={formulaEditor}
      onConvergenceChange={onConvergenceChange}
      onAddCondition={onAddConvergenceCondition}
      onDeleteCondition={onDeleteConvergenceCondition}
    />

    <MeasurementErrorSection
      formData={formData}
      formulaEditor={formulaEditor}
      onTypeChange={onMeasurementErrorTypeChange}
      onValueChange={onMeasurementErrorValueChange}
    />

    <RoundingSection formData={formData} onInputChange={onInputChange} />
  </>
);
