/** Форма промежуточного поля метода исследования. */
export type IntermediateFieldForm = {
  clientKey: string;
  name: string;
  formula: string;
  description: string;
  unit?: string;
  show_calculation: boolean;
  use_multiple_rounding: boolean;
  multiple_value: string;
  use_result_rounding?: boolean;
  rounding_type?: 'decimal' | 'significant' | 'multiple';
  rounding_decimal?: number;
  range_calculation?: {
    ranges: { clientKey: string; condition: string; formula: string }[];
  };
  use_threshold_table?: boolean;
  threshold_table_values?: {
    target_variable: string;
    higher_variable: string;
    lower_variable: string;
  };
};

/** Форма погрешности измерения. */
export type MeasurementErrorForm = {
  type: 'fixed' | 'formula' | 'range' | 'none';
  value: string;
  ranges: { formula: string; value: string }[];
};

/** Форма условия сходимости. */
export type ConvergenceFormulaForm = {
  clientKey: string;
  formula: string;
  convergence_value: string;
  custom_value?: string;
};

/** Данные формы одиночного метода исследования. */
export type ResearchMethodFormData = {
  name: string;
  sample_type: string[];
  formula: string;
  measurement_error: MeasurementErrorForm;
  unit: string;
  measurement_method: string;
  nd_code: string;
  nd_name: string;
  input_data: {
    fields: {
      clientKey: string;
      name: string;
      description: string;
      unit?: string;
      card_index: number;
    }[];
  };
  intermediate_data: {
    fields: IntermediateFieldForm[];
  };
  convergence_conditions: {
    formulas: ConvergenceFormulaForm[];
  };
  rounding_type: 'decimal' | 'significant';
  rounding_decimal: number;
};
