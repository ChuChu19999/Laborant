import { useRef, useState } from 'react';
import { applyFormulaKeyPress, createClientKey } from '../lib';
import type { ResearchMethodFormData } from '../lib';
import type { InputRef } from '@/shared/ui/FormItems';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

export type FormulaRefs = {
  main: MutableRefObject<InputRef | null>;
  convergence: MutableRefObject<(InputRef | null)[]>;
  intermediate: MutableRefObject<Record<number, Record<number, Record<string, InputRef | null>>>>;
  error: MutableRefObject<InputRef | null>;
  range: MutableRefObject<(InputRef | null)[]>;
  threshold: Record<number, Record<string, InputRef | null>>;
};

export type FormulaFieldEditor = {
  activeFormulaField: string | null;
  setActiveFormulaField: Dispatch<SetStateAction<string | null>>;
  formulaRefs: FormulaRefs;
  handleFormulaKeyPress: (value: string) => void;
  getAvailableVariables: (type: string, currentIndex?: number | null) => string[];
};

type UseFormulaFieldEditorParams = {
  formData: ResearchMethodFormData;
  setFormData: Dispatch<SetStateAction<ResearchMethodFormData>>;
  onMeasurementErrorRangeFormulaChange: (index: number, formula: string) => void;
};

export const useFormulaFieldEditor = ({
  formData,
  setFormData,
  onMeasurementErrorRangeFormulaChange,
}: UseFormulaFieldEditorParams): FormulaFieldEditor => {
  const [activeFormulaField, setActiveFormulaField] = useState<string | null>(null);
  const mainRef = useRef<InputRef>(null);
  const convergenceRef = useRef<(InputRef | null)[]>([]);
  const intermediateRef = useRef<Record<number, Record<number, Record<string, InputRef | null>>>>(
    {}
  );
  const errorRef = useRef<InputRef>(null);
  const rangeRef = useRef<(InputRef | null)[]>([]);
  const thresholdRefs = useRef<Record<number, Record<string, InputRef | null>>>({});

  const formulaRefs: FormulaRefs = {
    main: mainRef,
    convergence: convergenceRef,
    intermediate: intermediateRef,
    error: errorRef,
    range: rangeRef,
    threshold: thresholdRefs.current,
  };

  const handleIntermediateRangeChange = (
    fieldIndex: number,
    rangeIndex: number,
    key: string,
    value: string
  ) => {
    setFormData(prev => {
      const fields = [...prev.intermediate_data.fields];
      const existingField = fields[fieldIndex];
      if (!existingField) {
        return prev;
      }
      const field = { ...existingField };

      if (!field.range_calculation) {
        field.range_calculation = { ranges: [] };
      }

      const ranges = [...field.range_calculation.ranges];
      const existingRange = ranges[rangeIndex];
      ranges[rangeIndex] = {
        clientKey: existingRange?.clientKey ?? createClientKey(),
        condition: existingRange?.condition ?? '',
        formula: existingRange?.formula ?? '',
        [key]: value,
      };

      field.range_calculation.ranges = ranges;
      fields[fieldIndex] = field;

      return {
        ...prev,
        intermediate_data: {
          ...prev.intermediate_data,
          fields,
        },
      };
    });
  };

  const handleFormulaKeyPress = (value: string) => {
    if (!activeFormulaField) return;

    const parts = activeFormulaField.split('-');
    const type = parts[0];
    const index = parts[1] ? parseInt(parts[1]) : null;
    const rangeIndex = parts[2] ? parseInt(parts[2]) : null;
    const field = parts[3];

    if (
      type === 'intermediate' &&
      rangeIndex !== undefined &&
      rangeIndex !== null &&
      field &&
      index !== null &&
      index !== undefined
    ) {
      const fieldIndex = index;
      const rangeIdx = rangeIndex;
      const refObj = formulaRefs.intermediate.current[fieldIndex] as Record<
        number,
        Record<string, InputRef | null>
      > | null;
      if (!refObj || !refObj[rangeIdx] || !refObj[rangeIdx][field]) return;
      const inputRef = refObj[rangeIdx][field];
      if (!inputRef || !inputRef.input) return;
      const input = inputRef.input;

      applyFormulaKeyPress(input, value, newValue => {
        handleIntermediateRangeChange(fieldIndex, rangeIdx, field, newValue);
      });
      return;
    }

    if (type === 'main' && formulaRefs.main.current?.input) {
      const input = formulaRefs.main.current.input;
      applyFormulaKeyPress(input, value, newValue => {
        setFormData(prev => ({ ...prev, formula: newValue }));
      });
    } else if (type === 'error' && formulaRefs.error.current?.input) {
      const input = formulaRefs.error.current.input;
      applyFormulaKeyPress(input, value, newValue => {
        setFormData(prev => ({
          ...prev,
          measurement_error: {
            ...prev.measurement_error,
            value: newValue,
          },
        }));
      });
    } else if (
      type === 'convergence' &&
      index !== null &&
      index !== undefined &&
      formulaRefs.convergence.current[index]
    ) {
      const formulas = [...formData.convergence_conditions.formulas];
      const inputRef = formulaRefs.convergence.current[index];
      const input = inputRef?.input;
      if (!input) return;

      applyFormulaKeyPress(input, value, newValue => {
        const existing = formulas[index];
        if (!existing) return;
        formulas[index] = { ...existing, formula: newValue };
        setFormData(prev => ({
          ...prev,
          convergence_conditions: { formulas },
        }));
      });
    } else if (
      type === 'intermediate' &&
      index !== null &&
      index !== undefined &&
      formulaRefs.intermediate.current[index] &&
      formulaRefs.intermediate.current[index][-1]?.formula
    ) {
      const fields = [...formData.intermediate_data.fields];
      const inputRef = formulaRefs.intermediate.current[index][-1]?.formula;
      if (!inputRef?.input) return;
      const input = inputRef.input;

      applyFormulaKeyPress(input, value, newValue => {
        const existing = fields[index];
        if (!existing) return;
        fields[index] = { ...existing, formula: newValue };
        setFormData(prev => ({
          ...prev,
          intermediate_data: { fields },
        }));
      });
    } else if (
      type === 'range' &&
      index !== null &&
      index !== undefined &&
      formulaRefs.range.current[index]
    ) {
      const inputRef = formulaRefs.range.current[index];
      const input = inputRef?.input;
      if (!input) return;

      applyFormulaKeyPress(input, value, newValue => {
        onMeasurementErrorRangeFormulaChange(index, newValue);
      });
    }
  };

  const inputVariables = formData.input_data.fields
    .map(fieldItem => fieldItem.name)
    .filter(name => name.trim() !== '');

  const getAvailableVariables = (type: string, currentIndex: number | null = null): string[] => {
    const intermediateVariables = formData.intermediate_data.fields
      .map(fieldItem => fieldItem.name)
      .filter(name => name.trim() !== '');

    if (type === 'main' || type === 'convergence' || type === 'error' || type === 'range') {
      return [...inputVariables, ...intermediateVariables];
    }

    if (type === 'intermediate' && currentIndex !== null) {
      const previousIntermediateVars = intermediateVariables.slice(0, currentIndex);
      return [...inputVariables, ...previousIntermediateVars];
    }

    return inputVariables;
  };

  return {
    activeFormulaField,
    setActiveFormulaField,
    formulaRefs,
    handleFormulaKeyPress,
    getAvailableVariables,
  };
};
