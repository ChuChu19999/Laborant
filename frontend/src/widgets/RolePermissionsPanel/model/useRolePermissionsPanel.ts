import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { buildVisibilityScopeOptions, useLaboratoriesWithDepartments } from '@/entities/Laboratory';
import {
  defaultRolePermissions,
  roleScopesToSelectValues,
  scopeBindingKey,
  selectValuesToRoleScopes,
  syncCrudReadFromNavigation,
  useRoleById,
  useUpdateRole,
  type NavigationKey,
  type RolePermissions,
  type RoleScopeBinding,
} from '@/entities/Role';
import { notify } from '@/shared/lib/notify';
import { normalizeScopePermissions } from '../lib/normalizeScopePermissions';

export const CRUD_SECTIONS: {
  key: keyof Pick<
    RolePermissions,
    'protocols' | 'equipment' | 'sampling_locations' | 'nd_norms' | 'refraction_tables'
  >;
  title: string;
  navigationKey: NavigationKey;
}[] = [
  { key: 'protocols', title: 'Протоколы', navigationKey: 'protocols' },
  { key: 'equipment', title: 'Приборы', navigationKey: 'equipment' },
  { key: 'sampling_locations', title: 'Места отбора проб', navigationKey: 'sampling_locations' },
  { key: 'nd_norms', title: 'Нормы НД', navigationKey: 'nd_norms' },
  {
    key: 'refraction_tables',
    title: 'Градуировочный график',
    navigationKey: 'refraction_tables',
  },
];

export const CRUD_ACTIONS = ['create', 'update', 'delete'] as const;

export const CRUD_ACTION_LABELS: Record<(typeof CRUD_ACTIONS)[number], string> = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
};

export const CALCULATION_ACTIONS = [
  'execute',
  'create',
  'update',
  'delete',
  'show_equipment',
] as const;

export const CALCULATION_ACTION_LABELS: Record<(typeof CALCULATION_ACTIONS)[number], string> = {
  execute: 'Проведение расчётов',
  create: 'Сохранение',
  update: 'Изменение',
  delete: 'Удаление',
  show_equipment: 'Поле «Приборы» при сохранении',
};

/** Оркестрация экрана настройки прав роли: загрузка, scopes, сохранение. */
export const useRolePermissionsPanel = () => {
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();
  const updateMutation = useUpdateRole();
  const { labsWithDepartments, isLoading: labsLoading } = useLaboratoriesWithDepartments(true);

  const numericRoleId = useMemo(() => {
    const parsed = Number(roleId);
    return Number.isNaN(parsed) ? undefined : parsed;
  }, [roleId]);

  const {
    data: role,
    isLoading: roleLoading,
    isError: roleError,
  } = useRoleById(numericRoleId, !!numericRoleId);

  const [scopes, setScopes] = useState<RoleScopeBinding[]>([]);
  const [activeScopeKey, setActiveScopeKey] = useState<string | null>(null);
  const [draftSourceRoleId, setDraftSourceRoleId] = useState<number | null>(null);

  if (role && draftSourceRoleId !== role.id) {
    const loadedScopes = (role.scopes || []).map(scope => ({
      ...scope,
      permissions: normalizeScopePermissions(scope.permissions),
    }));
    setDraftSourceRoleId(role.id);
    setScopes(loadedScopes);
    setActiveScopeKey(loadedScopes[0] ? scopeBindingKey(loadedScopes[0]) : null);
  }

  useEffect(() => {
    if (!roleError) {
      return;
    }
    notify.error('Не удалось загрузить роль');
  }, [roleError]);

  const options = useMemo(
    () => buildVisibilityScopeOptions(labsWithDepartments),
    [labsWithDepartments]
  );

  const selectedValues = useMemo(() => roleScopesToSelectValues(scopes), [scopes]);

  const activeScope = useMemo(() => {
    if (!activeScopeKey) {
      return null;
    }
    return scopes.find(scope => scopeBindingKey(scope) === activeScopeKey) || null;
  }, [scopes, activeScopeKey]);

  const permissions = activeScope?.permissions || defaultRolePermissions();

  const updateActivePermissions = useCallback(
    (updater: (prev: RolePermissions) => RolePermissions) => {
      if (!activeScopeKey) {
        return;
      }
      setScopes(prev =>
        prev.map(scope => {
          if (scopeBindingKey(scope) !== activeScopeKey) {
            return scope;
          }
          return {
            ...scope,
            permissions: syncCrudReadFromNavigation(updater(scope.permissions)),
          };
        })
      );
    },
    [activeScopeKey]
  );

  const handleScopesSelectChange = useCallback(
    (rawValues: unknown) => {
      const values = Array.isArray(rawValues) ? (rawValues as string[]) : [];
      setScopes(prev => {
        const next = selectValuesToRoleScopes(values, labsWithDepartments, prev);
        setActiveScopeKey(current => {
          if (current && next.some(scope => scopeBindingKey(scope) === current)) {
            return current;
          }
          return next[0] ? scopeBindingKey(next[0]) : null;
        });
        return next;
      });
    },
    [labsWithDepartments]
  );

  const handleSave = useCallback(async () => {
    if (!role) {
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: role.id,
        data: {
          scopes: scopes.map(scope => ({
            laboratory_id: scope.laboratory_id,
            department_id: scope.department_id ?? null,
            permissions: syncCrudReadFromNavigation(scope.permissions),
          })),
        },
      });
      void navigate('/roles');
    } catch {
      // Ошибку показывает useUpdateRole / useMutation.
    }
  }, [role, scopes, updateMutation, navigate]);

  const toggleNav = (key: NavigationKey, checked: boolean) => {
    updateActivePermissions(prev => ({
      ...prev,
      navigation: { ...prev.navigation, home: true, [key]: checked },
    }));
  };

  const toggleSampleField = (field: string, checked: boolean) => {
    updateActivePermissions(prev => {
      const current = new Set(prev.samples.visible_fields);
      if (checked) {
        current.add(field);
      } else {
        current.delete(field);
      }
      return {
        ...prev,
        samples: { ...prev.samples, visible_fields: Array.from(current) },
      };
    });
  };

  const breadcrumbsForRole = useMemo(
    () => [
      {
        label: 'Главная',
        onClick: () => {
          void navigate('/');
        },
      },
      {
        label: 'Роли',
        onClick: () => {
          void navigate('/roles');
        },
      },
      { label: role?.name || 'Настройка прав' },
    ],
    [navigate, role?.name]
  );

  const breadcrumbsNotFound = useMemo(
    () => [
      {
        label: 'Главная',
        onClick: () => {
          void navigate('/');
        },
      },
      {
        label: 'Роли',
        onClick: () => {
          void navigate('/roles');
        },
      },
      { label: 'Настройка прав' },
    ],
    [navigate]
  );

  return {
    role,
    roleLoading,
    roleError,
    labsLoading,
    scopes,
    activeScopeKey,
    setActiveScopeKey,
    draftSourceRoleId,
    options,
    selectedValues,
    activeScope,
    permissions,
    updateMutation,
    updateActivePermissions,
    handleScopesSelectChange,
    handleSave,
    toggleNav,
    toggleSampleField,
    breadcrumbsForRole,
    breadcrumbsNotFound,
    navigateToRoles: () => {
      void navigate('/roles');
    },
  };
};
