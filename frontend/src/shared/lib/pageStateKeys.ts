/**
 * Ключи для сохранения состояний страниц в sessionStorage
 */
export const PAGE_STATE_KEYS = {
  ADMIN_PAGE: 'lastAdminPagePath',
  SAMPLES_PAGE: 'lastSamplesPagePath',
  PROTOCOLS_PAGE: 'lastProtocolsPagePath',
  EQUIPMENT_PAGE: 'lastEquipmentPagePath',
  ND_NORMS_PAGE: 'lastNdNormsPagePath',
  SAMPLING_LOCATIONS_PAGE: 'lastSamplingLocationsPagePath',
  MAIN_PAGE: 'lastMainPagePath',
  LABORATORY_MANAGEMENT_PAGE: 'lastLaboratoryManagementPagePath',
} as const;
