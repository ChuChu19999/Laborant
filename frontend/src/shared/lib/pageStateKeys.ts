/**
 * Ключи для сохранения состояний страниц в sessionStorage
 */
export const PAGE_STATE_KEYS = {
  ADMIN_PAGE: 'lastAdminPagePath',
  SAMPLES_PAGE: 'lastSamplesPagePath',
  PROTOCOLS_PAGE: 'lastProtocolsPagePath',
  EQUIPMENT_PAGE: 'lastEquipmentPagePath',
  SAMPLING_LOCATIONS_PAGE: 'lastSamplingLocationsPagePath',
  MAIN_PAGE: 'lastMainPagePath',
} as const;
