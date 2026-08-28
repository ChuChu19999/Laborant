import { create } from 'zustand';
import { logger } from '@/shared/lib/zustand';
import type { QueryState } from '@/shared/lib/zustand';

/** Состояние пагинации, фильтров и области видимости списка оборудования. */
export interface EquipmentQueryState extends QueryState {
  laboratoryId?: number;
  departmentId?: number;
  filters?: {
    name?: string;
    serial_number?: string;
    type?: string;
    verification_end_date_from?: string;
    verification_end_date_to?: string;
    created_at_from?: string;
    created_at_to?: string;
  };
}

interface EquipmentQueryStore {
  equipmentQuery: EquipmentQueryState;
  setEquipmentPage: (page: number) => void;
  setEquipmentPageSize: (pageSize: number) => void;
  setEquipmentFilters: (filters: EquipmentQueryState['filters']) => void;
  setEquipmentSorting: (sorting: EquipmentQueryState['sorting']) => void;
  setEquipmentLaboratoryId: (laboratoryId: number | undefined) => void;
  setEquipmentDepartmentId: (departmentId: number | undefined) => void;
  resetEquipmentQuery: () => void;
}

const defaultQueryState: QueryState = {
  page: 1,
  pageSize: 20,
};

/** Zustand-хранилище параметров запроса списка оборудования. */
export const useEquipmentQueryStore = create<EquipmentQueryStore>()(
  logger(set => ({
    equipmentQuery: { ...defaultQueryState },
    setEquipmentPage: page =>
      set(state => ({
        equipmentQuery: { ...state.equipmentQuery, page },
      })),
    setEquipmentPageSize: pageSize =>
      set(state => ({
        equipmentQuery: { ...state.equipmentQuery, pageSize, page: 1 },
      })),
    setEquipmentFilters: filters =>
      set(state => ({
        equipmentQuery: { ...state.equipmentQuery, filters, page: 1 },
      })),
    setEquipmentSorting: sorting =>
      set(state => ({
        equipmentQuery: { ...state.equipmentQuery, sorting, page: 1 },
      })),
    setEquipmentLaboratoryId: laboratoryId =>
      set(state => ({
        equipmentQuery: { ...state.equipmentQuery, laboratoryId, page: 1 },
      })),
    setEquipmentDepartmentId: departmentId =>
      set(state => ({
        equipmentQuery: { ...state.equipmentQuery, departmentId, page: 1 },
      })),
    resetEquipmentQuery: () =>
      set({
        equipmentQuery: { ...defaultQueryState },
      }),
  }))
);
