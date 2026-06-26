import { create } from 'zustand';
import { logger } from '../../lib/zustand/middleware';
import type { RoleFilters } from '../../api/roles';
import type { QueryState } from '../../lib/zustand/types';

/**
 * Интерфейс для параметров запросов методов исследования
 */
export interface ResearchMethodsQueryState extends QueryState {
  laboratoryId?: number;
  departmentId?: number;
  filters?: {
    search?: string;
    rounding_type?: string;
  };
}

/**
 * Интерфейс для параметров запросов проб
 */
export interface SamplesQueryState extends QueryState {
  laboratoryId?: number;
  departmentId?: number;
  filters?: {
    registration_number?: string;
    test_object?: string;
    sampling_date_from?: string;
    sampling_date_to?: string;
    receiving_date_from?: string;
    receiving_date_to?: string;
    created_at_from?: string;
    created_at_to?: string;
  };
}

/**
 * Интерфейс для параметров запросов протоколов
 */
export interface ProtocolsQueryState extends QueryState {
  laboratoryId?: number;
  departmentId?: number;
  filters?: {
    test_protocol_number?: string;
    sampling_act_number?: string;
    test_protocol_date_from?: string;
    test_protocol_date_to?: string;
    created_at_from?: string;
    created_at_to?: string;
  };
}

/**
 * Интерфейс для параметров запросов оборудования
 */
export interface TestObjectsQueryState extends QueryState {
  filters?: {
    search?: string;
    name?: string;
    tag?: string;
  };
}

export interface RolesQueryState extends QueryState {
  filters?: RoleFilters;
}

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

export interface NdNormsQueryState extends QueryState {
  laboratoryId?: number;
  departmentId?: number;
  filters?: {
    name?: string;
    created_at_from?: string;
    created_at_to?: string;
  };
}

interface QueryStore {
  researchMethodsQuery: ResearchMethodsQueryState;
  setResearchMethodsPage: (page: number) => void;
  setResearchMethodsPageSize: (pageSize: number) => void;
  setResearchMethodsFilters: (filters: ResearchMethodsQueryState['filters']) => void;
  setResearchMethodsSorting: (sorting: ResearchMethodsQueryState['sorting']) => void;
  setResearchMethodsLaboratoryId: (laboratoryId: number | undefined) => void;
  setResearchMethodsDepartmentId: (departmentId: number | undefined) => void;
  resetResearchMethodsQuery: () => void;
  samplesQuery: SamplesQueryState;
  setSamplesPage: (page: number) => void;
  setSamplesPageSize: (pageSize: number) => void;
  setSamplesFilters: (filters: SamplesQueryState['filters']) => void;
  setSamplesSorting: (sorting: SamplesQueryState['sorting']) => void;
  setSamplesLaboratoryId: (laboratoryId: number | undefined) => void;
  setSamplesDepartmentId: (departmentId: number | undefined) => void;
  resetSamplesQuery: () => void;
  protocolsQuery: ProtocolsQueryState;
  setProtocolsPage: (page: number) => void;
  setProtocolsPageSize: (pageSize: number) => void;
  setProtocolsFilters: (filters: ProtocolsQueryState['filters']) => void;
  setProtocolsSorting: (sorting: ProtocolsQueryState['sorting']) => void;
  setProtocolsLaboratoryId: (laboratoryId: number | undefined) => void;
  setProtocolsDepartmentId: (departmentId: number | undefined) => void;
  resetProtocolsQuery: () => void;
  equipmentQuery: EquipmentQueryState;
  setEquipmentPage: (page: number) => void;
  setEquipmentPageSize: (pageSize: number) => void;
  setEquipmentFilters: (filters: EquipmentQueryState['filters']) => void;
  setEquipmentSorting: (sorting: EquipmentQueryState['sorting']) => void;
  setEquipmentLaboratoryId: (laboratoryId: number | undefined) => void;
  setEquipmentDepartmentId: (departmentId: number | undefined) => void;
  resetEquipmentQuery: () => void;
  ndNormsQuery: NdNormsQueryState;
  setNdNormsPage: (page: number) => void;
  setNdNormsPageSize: (pageSize: number) => void;
  setNdNormsFilters: (filters: NdNormsQueryState['filters']) => void;
  setNdNormsSorting: (sorting: NdNormsQueryState['sorting']) => void;
  setNdNormsLaboratoryId: (laboratoryId: number | undefined) => void;
  setNdNormsDepartmentId: (departmentId: number | undefined) => void;
  resetNdNormsQuery: () => void;
  testObjectsQuery: TestObjectsQueryState;
  setTestObjectsPage: (page: number) => void;
  setTestObjectsPageSize: (pageSize: number) => void;
  setTestObjectsFilters: (filters: TestObjectsQueryState['filters']) => void;
  setTestObjectsSorting: (sorting: TestObjectsQueryState['sorting']) => void;
  resetTestObjectsQuery: () => void;
  rolesQuery: RolesQueryState;
  setRolesPage: (page: number) => void;
  setRolesPageSize: (pageSize: number) => void;
  setRolesFilters: (filters: RolesQueryState['filters']) => void;
  setRolesSorting: (sorting: RolesQueryState['sorting']) => void;
  resetRolesQuery: () => void;
  resetAllQueries: () => void;
}

/**
 * Дефолтное состояние для query параметров
 */
const defaultQueryState: QueryState = {
  page: 1,
  pageSize: 20,
};

/**
 * Query Store - управление параметрами запросов
 * Использует logger middleware для логирования изменений в режиме разработки
 */
export const useQueryStore = create<QueryStore>()(
  logger(set => ({
    researchMethodsQuery: { ...defaultQueryState },
    setResearchMethodsPage: page =>
      set(state => ({
        researchMethodsQuery: { ...state.researchMethodsQuery, page },
      })),
    setResearchMethodsPageSize: pageSize =>
      set(state => ({
        researchMethodsQuery: { ...state.researchMethodsQuery, pageSize, page: 1 },
      })),
    setResearchMethodsFilters: filters =>
      set(state => ({
        researchMethodsQuery: { ...state.researchMethodsQuery, filters, page: 1 },
      })),
    setResearchMethodsSorting: sorting =>
      set(state => ({
        researchMethodsQuery: { ...state.researchMethodsQuery, sorting, page: 1 },
      })),
    setResearchMethodsLaboratoryId: laboratoryId =>
      set(state => ({
        researchMethodsQuery: { ...state.researchMethodsQuery, laboratoryId, page: 1 },
      })),
    setResearchMethodsDepartmentId: departmentId =>
      set(state => ({
        researchMethodsQuery: { ...state.researchMethodsQuery, departmentId, page: 1 },
      })),
    resetResearchMethodsQuery: () =>
      set({
        researchMethodsQuery: { ...defaultQueryState },
      }),
    samplesQuery: { ...defaultQueryState },
    setSamplesPage: page =>
      set(state => ({
        samplesQuery: { ...state.samplesQuery, page },
      })),
    setSamplesPageSize: pageSize =>
      set(state => ({
        samplesQuery: { ...state.samplesQuery, pageSize, page: 1 },
      })),
    setSamplesFilters: filters =>
      set(state => ({
        samplesQuery: { ...state.samplesQuery, filters, page: 1 },
      })),
    setSamplesSorting: sorting =>
      set(state => ({
        samplesQuery: { ...state.samplesQuery, sorting, page: 1 },
      })),
    setSamplesLaboratoryId: laboratoryId =>
      set(state => ({
        samplesQuery: { ...state.samplesQuery, laboratoryId, page: 1 },
      })),
    setSamplesDepartmentId: departmentId =>
      set(state => ({
        samplesQuery: { ...state.samplesQuery, departmentId, page: 1 },
      })),
    resetSamplesQuery: () =>
      set({
        samplesQuery: { ...defaultQueryState },
      }),
    protocolsQuery: { ...defaultQueryState },
    setProtocolsPage: page =>
      set(state => ({
        protocolsQuery: { ...state.protocolsQuery, page },
      })),
    setProtocolsPageSize: pageSize =>
      set(state => ({
        protocolsQuery: { ...state.protocolsQuery, pageSize, page: 1 },
      })),
    setProtocolsFilters: filters =>
      set(state => ({
        protocolsQuery: { ...state.protocolsQuery, filters, page: 1 },
      })),
    setProtocolsSorting: sorting =>
      set(state => ({
        protocolsQuery: { ...state.protocolsQuery, sorting, page: 1 },
      })),
    setProtocolsLaboratoryId: laboratoryId =>
      set(state => ({
        protocolsQuery: { ...state.protocolsQuery, laboratoryId, page: 1 },
      })),
    setProtocolsDepartmentId: departmentId =>
      set(state => ({
        protocolsQuery: { ...state.protocolsQuery, departmentId, page: 1 },
      })),
    resetProtocolsQuery: () =>
      set({
        protocolsQuery: { ...defaultQueryState },
      }),
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
    ndNormsQuery: { ...defaultQueryState },
    setNdNormsPage: page =>
      set(state => ({
        ndNormsQuery: { ...state.ndNormsQuery, page },
      })),
    setNdNormsPageSize: pageSize =>
      set(state => ({
        ndNormsQuery: { ...state.ndNormsQuery, pageSize, page: 1 },
      })),
    setNdNormsFilters: filters =>
      set(state => ({
        ndNormsQuery: { ...state.ndNormsQuery, filters, page: 1 },
      })),
    setNdNormsSorting: sorting =>
      set(state => ({
        ndNormsQuery: { ...state.ndNormsQuery, sorting, page: 1 },
      })),
    setNdNormsLaboratoryId: laboratoryId =>
      set(state => ({
        ndNormsQuery: { ...state.ndNormsQuery, laboratoryId, page: 1 },
      })),
    setNdNormsDepartmentId: departmentId =>
      set(state => ({
        ndNormsQuery: { ...state.ndNormsQuery, departmentId, page: 1 },
      })),
    resetNdNormsQuery: () =>
      set({
        ndNormsQuery: { ...defaultQueryState },
      }),
    testObjectsQuery: { ...defaultQueryState },
    setTestObjectsPage: page =>
      set(state => ({
        testObjectsQuery: { ...state.testObjectsQuery, page },
      })),
    setTestObjectsPageSize: pageSize =>
      set(state => ({
        testObjectsQuery: { ...state.testObjectsQuery, pageSize, page: 1 },
      })),
    setTestObjectsFilters: filters =>
      set(state => ({
        testObjectsQuery: { ...state.testObjectsQuery, filters, page: 1 },
      })),
    setTestObjectsSorting: sorting =>
      set(state => ({
        testObjectsQuery: { ...state.testObjectsQuery, sorting, page: 1 },
      })),
    resetTestObjectsQuery: () =>
      set({
        testObjectsQuery: { ...defaultQueryState },
      }),
    rolesQuery: { ...defaultQueryState },
    setRolesPage: page =>
      set(state => ({
        rolesQuery: { ...state.rolesQuery, page },
      })),
    setRolesPageSize: pageSize =>
      set(state => ({
        rolesQuery: { ...state.rolesQuery, pageSize, page: 1 },
      })),
    setRolesFilters: filters =>
      set(state => ({
        rolesQuery: { ...state.rolesQuery, filters, page: 1 },
      })),
    setRolesSorting: sorting =>
      set(state => ({
        rolesQuery: { ...state.rolesQuery, sorting, page: 1 },
      })),
    resetRolesQuery: () =>
      set({
        rolesQuery: { ...defaultQueryState },
      }),
    resetAllQueries: () =>
      set({
        researchMethodsQuery: { ...defaultQueryState },
        samplesQuery: { ...defaultQueryState },
        protocolsQuery: { ...defaultQueryState },
        equipmentQuery: { ...defaultQueryState },
        ndNormsQuery: { ...defaultQueryState },
        testObjectsQuery: { ...defaultQueryState },
        rolesQuery: { ...defaultQueryState },
      }),
  }))
);
