import { axiosInstance } from '../config/axios';

export interface CalculateRequest {
  input_data: Record<string, string | number | Record<string, Record<string, string>>>;
  research_method_id: number;
  equipment_data?: number[];
}

export interface CalculationResult {
  result?: string;
  measurement_error?: string;
  unit?: string;
  convergence?: string;
  intermediate_results?: Record<string, string>;
  conditions_info?: Array<{
    satisfied: boolean;
    formula?: string;
    calculation_steps?: {
      type?: string;
      step?: {
        evaluated?: string;
      };
      steps?: Array<{
        evaluated?: string;
      }>;
      step2?: string;
    };
    convergence_value?: string;
  }>;
  is_fractional_composition?: boolean;
  updated_input_data?: Record<string, string | number>;
}

export const calculationApi = {
  calculate: async (request: CalculateRequest): Promise<CalculationResult> => {
    const response = await axiosInstance.post<CalculationResult>('/api/calculate/', request);
    return response.data;
  },
};
