/**
 * Ключи sessionStorage для восстановления последнего пути разделов.
 * Общие для SideBar и страниц.
 */
export const PAGE_STATE_KEYS = {
  ADMIN_PAGE: 'lastAdminPagePath',
  SAMPLES_PAGE: 'lastSamplesPagePath',
  PROTOCOLS_PAGE: 'lastProtocolsPagePath',
  EQUIPMENT_PAGE: 'lastEquipmentPagePath',
  ND_NORMS_PAGE: 'lastNdNormsPagePath',
  REFRACTION_TABLES_PAGE: 'lastRefractionTablesPagePath',
  SAMPLING_LOCATIONS_PAGE: 'lastSamplingLocationsPagePath',
  MAIN_PAGE: 'lastMainPagePath',
  LABORATORY_MANAGEMENT_PAGE: 'lastLaboratoryManagementPagePath',
} as const;
