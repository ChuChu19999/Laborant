const pagePreloadByPath: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/MainPage'),
  '/samples': () => import('@/pages/SamplesPage'),
  '/protocols': () => import('@/pages/ProtocolsPage'),
  '/equipment': () => import('@/pages/EquipmentPage'),
  '/sampling-locations': () => import('@/pages/SamplingLocationsPage'),
  '/nd-norms': () => import('@/pages/NdNormsPage'),
  '/refraction-tables': () => import('@/pages/RefractionTablesPage'),
  '/laboratory-management': () => import('@/pages/LaboratoryManagementPage'),
  '/test-objects': () => import('@/pages/TestObjectsPage'),
  '/roles': () => import('@/pages/RolesPage'),
  '/help': () => import('@/pages/HelpPage'),
};

const preloadTargets = [
  () => import('@/pages/MainPage'),
  () => import('@/pages/SamplesPage'),
  () => import('@/pages/ProtocolsPage'),
  () => import('@/pages/EquipmentPage'),
  () => import('@/pages/SamplingLocationsPage'),
  () => import('@/pages/NdNormsPage'),
  () => import('@/pages/RefractionTablesPage'),
  () => import('@/pages/LaboratoryManagementPage'),
  () => import('@/pages/TestObjectsPage'),
  () => import('@/pages/RolesPage'),
  () => import('@/pages/HelpPage'),
  () => import('@/pages/CalculationsPage'),
  () => import('@/pages/AdminPage'),
  () => import('@/pages/RolePermissionsPage'),
  () => import('@/pages/ForbiddenPage'),
  () => import('@/pages/NotFoundPage'),
];

export function preloadAppPages() {
  const runWhenIdle = (callback: IdleRequestCallback) => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(callback);
      return;
    }

    window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 1500);
  };

  runWhenIdle(() => {
    preloadTargets.forEach(load => {
      void load();
    });
  });
}

/** Подгрузить чанк страницы при наведении на пункт меню. */
export function preloadPageByPath(path: string) {
  const [pathname = path] = path.split('?');
  const normalized = pathname.replace(/\/$/, '') || '/';
  const loader = pagePreloadByPath[normalized];

  if (loader) {
    void loader();
  }
}
