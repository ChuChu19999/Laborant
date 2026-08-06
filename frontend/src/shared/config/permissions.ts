export type SamplingTerminology = 'well_mode' | 'sampling_point';

export const SAMPLE_OPTIONAL_FIELDS = [
  'sample_type',
  'branch',
  'sampling_location',
  'well',
  'well_mode',
  'sampling_date',
  'receipt_date',
] as const;

export type SampleOptionalField = (typeof SAMPLE_OPTIONAL_FIELDS)[number];

export const SAMPLE_OPTIONAL_FIELD_LABELS: Record<SampleOptionalField, string> = {
  sample_type: 'Тип пробы',
  branch: 'Филиал',
  sampling_location: 'Место отбора пробы',
  well: 'Скважина',
  well_mode: 'Режим скважины / Точка отбора',
  sampling_date: 'Дата отбора пробы',
  receipt_date: 'Дата получения пробы',
};

export const SAMPLE_REQUIRED_FIELDS = [
  'registration_number',
  'test_object',
  'indicators_count',
  'added_by',
] as const;

export const NAVIGATION_KEYS = [
  'home',
  'samples',
  'protocols',
  'equipment',
  'sampling_locations',
  'nd_norms',
  'refraction_tables',
  'test_objects',
] as const;

/** Вкладки, которые настраиваются у роли. Главная и Помощь доступны всем. */
export const CONFIGURABLE_NAVIGATION_KEYS = [
  'samples',
  'protocols',
  'equipment',
  'sampling_locations',
  'nd_norms',
  'refraction_tables',
] as const;

export type NavigationKey = (typeof NAVIGATION_KEYS)[number];

export const NAVIGATION_PATH_MAP: Record<string, NavigationKey | 'help' | 'roles'> = {
  '/': 'home',
  '/samples': 'samples',
  '/protocols': 'protocols',
  '/equipment': 'equipment',
  '/sampling-locations': 'sampling_locations',
  '/nd-norms': 'nd_norms',
  '/refraction-tables': 'refraction_tables',
  '/test-objects': 'test_objects',
  '/help': 'help',
  '/roles': 'roles',
};

export const NAVIGATION_LABELS: Record<NavigationKey, string> = {
  home: 'Главная',
  samples: 'Поступления проб',
  protocols: 'Протоколы',
  equipment: 'Приборы',
  sampling_locations: 'Места отбора проб',
  nd_norms: 'Нормы НД',
  refraction_tables: 'Градуировочный график',
  test_objects: 'Объекты испытаний',
};

export const SAMPLING_TERMINOLOGY_LABELS: Record<SamplingTerminology, string> = {
  well_mode: 'Режим скважины',
  sampling_point: 'Точки отбора',
};

export interface NavigationPermissions {
  home: boolean;
  samples: boolean;
  protocols: boolean;
  equipment: boolean;
  sampling_locations: boolean;
  nd_norms: boolean;
  refraction_tables: boolean;
  test_objects: boolean;
}

export interface CrudPermissions {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

export interface RolePermissions {
  navigation: NavigationPermissions;
  laboratory_management: { access: boolean };
  samples: {
    visible_fields: string[];
    update: boolean;
    delete: boolean;
  };
  protocols: CrudPermissions;
  equipment: CrudPermissions;
  sampling_locations: CrudPermissions;
  nd_norms: CrudPermissions;
  refraction_tables: CrudPermissions;
  test_objects: CrudPermissions;
  calculations: {
    execute: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
    show_equipment: boolean;
  };
  sampling_terminology: SamplingTerminology;
}

export const defaultRolePermissions = (): RolePermissions => ({
  navigation: {
    home: true,
    samples: false,
    protocols: false,
    equipment: false,
    sampling_locations: false,
    nd_norms: false,
    refraction_tables: false,
    test_objects: false,
  },
  laboratory_management: { access: false },
  samples: {
    visible_fields: [],
    update: false,
    delete: false,
  },
  protocols: { read: false, create: false, update: false, delete: false },
  equipment: { read: false, create: false, update: false, delete: false },
  sampling_locations: { read: false, create: false, update: false, delete: false },
  nd_norms: { read: false, create: false, update: false, delete: false },
  refraction_tables: { read: false, create: false, update: false, delete: false },
  test_objects: { read: false, create: false, update: false, delete: false },
  calculations: {
    execute: false,
    create: false,
    update: false,
    delete: false,
    show_equipment: false,
  },
  sampling_terminology: 'well_mode',
});

export function syncCrudReadFromNavigation(permissions: RolePermissions): RolePermissions {
  const navigation = { ...permissions.navigation, home: true };
  return {
    ...permissions,
    navigation,
    protocols: { ...permissions.protocols, read: navigation.protocols },
    equipment: { ...permissions.equipment, read: navigation.equipment },
    sampling_locations: {
      ...permissions.sampling_locations,
      read: navigation.sampling_locations,
    },
    nd_norms: { ...permissions.nd_norms, read: navigation.nd_norms },
    refraction_tables: {
      ...permissions.refraction_tables,
      read: navigation.refraction_tables,
    },
  };
}

export function resolveNavigationKey(
  pathname: string
): NavigationKey | 'help' | 'roles' | 'admin' | null {
  if (pathname.startsWith('/admin') || pathname.startsWith('/laboratory-management')) {
    return 'admin';
  }
  if (pathname.startsWith('/roles')) {
    return 'roles';
  }
  if (pathname.startsWith('/help')) {
    return 'help';
  }
  if (pathname.startsWith('/samples')) {
    return 'samples';
  }
  if (pathname.startsWith('/protocols')) {
    return 'protocols';
  }
  if (pathname.startsWith('/equipment')) {
    return 'equipment';
  }
  if (pathname.startsWith('/sampling-locations')) {
    return 'sampling_locations';
  }
  if (pathname.startsWith('/nd-norms')) {
    return 'nd_norms';
  }
  if (pathname.startsWith('/refraction-tables')) {
    return 'refraction_tables';
  }
  if (pathname.startsWith('/test-objects')) {
    return 'test_objects';
  }
  if (pathname === '/') {
    return 'home';
  }
  return null;
}
