import { lazy, type ComponentType } from 'react';

function createLazyPage<P extends object = object>(
  factory: () => Promise<{ default: ComponentType<P> }>
): ComponentType<P> {
  return lazy(factory);
}

function lazyNamedPage<P extends object = object>(
  loader: () => Promise<Record<string, ComponentType<P>>>,
  exportName: string
) {
  return createLazyPage(async () => {
    const module = await loader();
    const component = module[exportName];

    if (!component) {
      throw new Error(`Страница "${exportName}" не найдена в public API`);
    }

    return { default: component };
  });
}

export const MainPage = lazyNamedPage(() => import('@/pages/MainPage'), 'MainPage');
export const SamplesPage = lazyNamedPage(() => import('@/pages/SamplesPage'), 'SamplesPage');
export const ProtocolsPage = lazyNamedPage(() => import('@/pages/ProtocolsPage'), 'ProtocolsPage');
export const EquipmentPage = lazyNamedPage(() => import('@/pages/EquipmentPage'), 'EquipmentPage');
export const SamplingLocationsPage = lazyNamedPage(
  () => import('@/pages/SamplingLocationsPage'),
  'SamplingLocationsPage'
);
export const NdNormsPage = lazyNamedPage(() => import('@/pages/NdNormsPage'), 'NdNormsPage');
export const RefractionTablesPage = lazyNamedPage(
  () => import('@/pages/RefractionTablesPage'),
  'RefractionTablesPage'
);
export const LaboratoryManagementPage = lazyNamedPage(
  () => import('@/pages/LaboratoryManagementPage'),
  'LaboratoryManagementPage'
);
export const TestObjectsPage = lazyNamedPage(
  () => import('@/pages/TestObjectsPage'),
  'TestObjectsPage'
);
export const RolesPage = lazyNamedPage(() => import('@/pages/RolesPage'), 'RolesPage');
export const HelpPage = lazyNamedPage(() => import('@/pages/HelpPage'), 'HelpPage');
export const AdminPage = lazyNamedPage(() => import('@/pages/AdminPage'), 'AdminPage');
export const CalculationsPage = lazyNamedPage(
  () => import('@/pages/CalculationsPage'),
  'CalculationsPage'
);
export const RolePermissionsPage = lazyNamedPage(
  () => import('@/pages/RolePermissionsPage'),
  'RolePermissionsPage'
);
export const ForbiddenPage = lazyNamedPage(() => import('@/pages/ForbiddenPage'), 'ForbiddenPage');
export const NotFoundPage = lazyNamedPage(() => import('@/pages/NotFoundPage'), 'NotFoundPage');
