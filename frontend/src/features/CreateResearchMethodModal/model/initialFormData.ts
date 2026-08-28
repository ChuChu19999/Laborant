import { createClientKey } from '../lib/createClientKey';
import type { ResearchMethodFormData } from '../lib';

export const createEmptyResearchMethodFormData = (): ResearchMethodFormData => ({
  name: '',
  sample_type: [],
  formula: '',
  measurement_error: {
    type: 'fixed',
    value: '',
    ranges: [],
  },
  unit: '',
  measurement_method: '',
  nd_code: '',
  nd_name: '',
  input_data: {
    fields: [{ clientKey: createClientKey(), name: '', description: '', unit: '', card_index: 1 }],
  },
  intermediate_data: {
    fields: [],
  },
  convergence_conditions: {
    formulas: [],
  },
  rounding_type: 'decimal',
  rounding_decimal: 0,
});
