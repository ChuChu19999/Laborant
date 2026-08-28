import type { ResearchMethod } from '@/entities/ResearchMethod';
import type { Dayjs } from 'dayjs';

export interface AvailableMethod {
  id: number | string;
  name: string;
  is_group?: boolean;
  group_id?: number;
  methods?: {
    id: number;
    name: string;
    input_data?: ResearchMethod['input_data'];
    intermediate_data?: ResearchMethod['intermediate_data'];
    unit?: string;
    equipment_data_default?: number[];
    sort_order?: number;
  }[];
  input_data?: ResearchMethod['input_data'];
  intermediate_data?: ResearchMethod['intermediate_data'];
  unit?: string;
  equipment_data_default?: number[];
  sort_order?: number;
}

export type CalculationsWorkspaceLastCalculationResult = {
  input_data: Record<string, unknown>;
  result: string;
  result_display?: string;
  measurement_error?: string;
  unit?: string;
  convergence?: string;
  laboratory_activity_date: Dayjs | null;
  equipment_data?: number[];
};
