export type SamplingTerminology = 'well_mode' | 'sampling_point';

export const SAMPLE_OPTIONAL_FIELDS = [
  'sample_type',
  'test_purpose',
  'branch',
  'sampling_location',
  'well',
  'well_mode',
  'sampling_date',
  'receipt_date',
  'customer_activity_place',
  'test_object_nd',
] as const;

export type SampleOptionalField = (typeof SAMPLE_OPTIONAL_FIELDS)[number];

export const SAMPLE_OPTIONAL_FIELD_LABELS: Record<SampleOptionalField, string> = {
  sample_type: 'Тип пробы',
  test_purpose: 'Цель испытаний',
  branch: 'Филиал',
  sampling_location: 'Место отбора пробы',
  well: 'Скважина',
  well_mode: 'Режим скважины / Точка отбора',
  sampling_date: 'Дата отбора пробы',
  receipt_date: 'Дата получения пробы',
  customer_activity_place: 'Место осуществления деятельности заказчика',
  test_object_nd: 'Нормативный документ на объект испытаний',
};

export const PROTOCOL_OPTIONAL_FIELDS = [
  'sampling_request_number',
  'sampling_request_date',
  'sampling_method_nd',
  'sampling_plan_number',
  'sampling_act_date',
] as const;

export type ProtocolOptionalField = (typeof PROTOCOL_OPTIONAL_FIELDS)[number];

export const PROTOCOL_OPTIONAL_FIELD_LABELS: Record<ProtocolOptionalField, string> = {
  sampling_request_number: 'Номер заявки на отбор пробы',
  sampling_request_date: 'Дата заявки отбора пробы',
  sampling_method_nd: 'Нормативный документ на метод отбора пробы',
  sampling_plan_number: 'Номер плана отбора проб',
  sampling_act_date: 'Дата акта отбора',
};

export const SAMPLE_REQUIRED_FIELDS = [
  'registration_number',
  'test_object',
  'indicators_count',
  'added_by',
] as const;

export const SAMPLING_LOCATION_OPTIONAL_FIELDS = ['phone'] as const;

export type SamplingLocationOptionalField = (typeof SAMPLING_LOCATION_OPTIONAL_FIELDS)[number];

export const SAMPLING_LOCATION_OPTIONAL_FIELD_LABELS: Record<
  SamplingLocationOptionalField,
  string
> = {
  phone: 'Номер телефона филиала',
};

export const NAVIGATION_KEYS = [
  'home',
  'samples',
  'protocols',
  'equipment',
  'sampling_locations',
  'sample_types',
  'test_purposes',
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
  'sample_types',
  'test_purposes',
  'nd_norms',
  'refraction_tables',
] as const;

export type ConfigurableNavigationKey = (typeof CONFIGURABLE_NAVIGATION_KEYS)[number];

export type NavigationKey = (typeof NAVIGATION_KEYS)[number];

export const NAVIGATION_PATH_MAP: Record<string, NavigationKey | 'help' | 'roles'> = {
  '/': 'home',
  '/samples': 'samples',
  '/protocols': 'protocols',
  '/equipment': 'equipment',
  '/sampling-locations': 'sampling_locations',
  '/sample-types': 'sample_types',
  '/test-purposes': 'test_purposes',
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
  sample_types: 'Типы проб',
  test_purposes: 'Цели испытаний',
  nd_norms: 'Нормы НД',
  refraction_tables: 'Градуировочный график',
  test_objects: 'Объекты испытаний',
};

export const SAMPLING_TERMINOLOGY_LABELS: Record<SamplingTerminology, string> = {
  well_mode: 'Режим скважины',
  sampling_point: 'Точки отбора',
};

export const ADMIN_SAMPLING_TERMINOLOGY_LABEL = 'Режим скважины/Точки отбора';

export interface NavigationPermissions {
  home: boolean;
  samples: boolean;
  protocols: boolean;
  equipment: boolean;
  sampling_locations: boolean;
  sample_types: boolean;
  test_purposes: boolean;
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

export interface SamplingLocationsPermissions extends CrudPermissions {
  visible_fields: string[];
}

export interface ProtocolsPermissions extends CrudPermissions {
  visible_fields: string[];
}

export interface RolePermissions {
  navigation: NavigationPermissions;
  laboratory_management: { access: boolean };
  samples: {
    visible_fields: string[];
    update: boolean;
    delete: boolean;
  };
  protocols: ProtocolsPermissions;
  equipment: CrudPermissions;
  sampling_locations: SamplingLocationsPermissions;
  sample_types: CrudPermissions;
  test_purposes: CrudPermissions;
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
    sample_types: false,
    test_purposes: false,
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
  protocols: {
    read: false,
    create: false,
    update: false,
    delete: false,
    visible_fields: [],
  },
  equipment: { read: false, create: false, update: false, delete: false },
  sampling_locations: {
    read: false,
    create: false,
    update: false,
    delete: false,
    visible_fields: [],
  },
  sample_types: { read: false, create: false, update: false, delete: false },
  test_purposes: { read: false, create: false, update: false, delete: false },
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
    sample_types: { ...permissions.sample_types, read: navigation.sample_types },
    test_purposes: { ...permissions.test_purposes, read: navigation.test_purposes },
    nd_norms: { ...permissions.nd_norms, read: navigation.nd_norms },
    refraction_tables: {
      ...permissions.refraction_tables,
      read: navigation.refraction_tables,
    },
  };
}

export function resolveNavigationKey(
  pathname: string
): NavigationKey | 'help' | 'roles' | 'monitoring' | 'admin' | null {
  if (pathname.startsWith('/admin') || pathname.startsWith('/laboratory-management')) {
    return 'admin';
  }
  if (pathname.startsWith('/roles')) {
    return 'roles';
  }
  if (pathname.startsWith('/monitoring')) {
    return 'monitoring';
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
  if (pathname.startsWith('/sample-types')) {
    return 'sample_types';
  }
  if (pathname.startsWith('/test-purposes')) {
    return 'test_purposes';
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

/** Читает флаг навигации. */
export function getNavigationPermission(
  navigation: NavigationPermissions,
  key: string
): boolean | undefined {
  for (const navigationKey of NAVIGATION_KEYS) {
    if (navigationKey === key) {
      return navigation[navigationKey];
    }
  }
  return undefined;
}
