import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Checkbox, Spin, message } from 'antd';
import { LoadingCard } from '../../features/Cards';
import { rolesApi } from '../../shared/api/roles';
import {
  CONFIGURABLE_NAVIGATION_KEYS,
  NAVIGATION_LABELS,
  SAMPLE_OPTIONAL_FIELDS,
  SAMPLE_OPTIONAL_FIELD_LABELS,
  SAMPLING_TERMINOLOGY_LABELS,
  defaultRolePermissions,
  syncCrudReadFromNavigation,
  type RolePermissions,
  type SamplingTerminology,
} from '../../shared/config/permissions';
import { scopeBindingKey } from '../../shared/lib/permissions';
import {
  buildVisibilityScopeOptions,
  formatRoleScopeLabel,
  roleScopesToSelectValues,
  selectValuesToRoleScopes,
} from '../../shared/lib/visibilityScopeOptions';
import { useUpdateRole } from '../../shared/model/hooks';
import { useLaboratoriesWithDepartments } from '../../shared/model/hooks/useLaboratoriesWithDepartments';
import Button from '../../shared/ui/Button';
import { RadioGroup, Select } from '../../shared/ui/FormItems';
import Layout from '../../shared/ui/Layout';
import { NavigationBar } from '../../widgets/NavigationBar';
import type { RoleCatalogItem, RoleScopeBinding } from '../../shared/api/roles';
import './RolePermissionsPage.css';

const CRUD_SECTIONS: Array<{
  key: keyof Pick<
    RolePermissions,
    'protocols' | 'equipment' | 'sampling_locations' | 'nd_norms' | 'refraction_tables'
  >;
  title: string;
  navigationKey: (typeof CONFIGURABLE_NAVIGATION_KEYS)[number];
}> = [
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

const CRUD_ACTIONS = ['create', 'update', 'delete'] as const;

const CRUD_ACTION_LABELS: Record<(typeof CRUD_ACTIONS)[number], string> = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
};

const normalizeScopePermissions = (permissions?: RolePermissions): RolePermissions =>
  syncCrudReadFromNavigation({
    ...(permissions || defaultRolePermissions()),
    navigation: {
      ...(permissions || defaultRolePermissions()).navigation,
      home: true,
    },
  });

const RolePermissionsPage: React.FC = () => {
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();
  const updateMutation = useUpdateRole();
  const { labsWithDepartments, isLoading: labsLoading } = useLaboratoriesWithDepartments(true);
  const [role, setRole] = useState<RoleCatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [scopes, setScopes] = useState<RoleScopeBinding[]>([]);
  const [activeScopeKey, setActiveScopeKey] = useState<string | null>(null);

  const numericRoleId = useMemo(() => Number(roleId), [roleId]);

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

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!numericRoleId || Number.isNaN(numericRoleId)) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await rolesApi.getRoleById(numericRoleId);
        if (cancelled) {
          return;
        }
        setRole(data);
        const loadedScopes = (data.scopes || []).map(scope => ({
          ...scope,
          permissions: normalizeScopePermissions(scope.permissions),
        }));
        setScopes(loadedScopes);
        setActiveScopeKey(loadedScopes[0] ? scopeBindingKey(loadedScopes[0]) : null);
      } catch {
        if (!cancelled) {
          message.error('Не удалось загрузить роль');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [numericRoleId]);

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
      navigate('/roles');
    } catch {
      // Ошибку показывает useUpdateRole / useMutation.
    }
  }, [role, scopes, updateMutation, navigate]);

  const toggleNav = (key: (typeof CONFIGURABLE_NAVIGATION_KEYS)[number], checked: boolean) => {
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

  if (loading) {
    return (
      <Layout title="Настройка прав">
        <LoadingCard loading />
        <div className="role-permissions-loading">
          <Spin size="large" />
        </div>
      </Layout>
    );
  }

  if (!role) {
    return (
      <Layout title="Настройка прав">
        <div className="role-permissions-layout">
          <NavigationBar
            breadcrumbs={[
              { label: 'Главная', onClick: () => navigate('/') },
              { label: 'Роли', onClick: () => navigate('/roles') },
              { label: 'Настройка прав' },
            ]}
            onBack={() => navigate('/roles')}
            showBack
          />
          <p className="role-permissions-error">Роль не найдена</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Права пользователя">
      <div className="role-permissions-layout">
        <NavigationBar
          breadcrumbs={[
            { label: 'Главная', onClick: () => navigate('/') },
            { label: 'Роли', onClick: () => navigate('/roles') },
            { label: role.name },
          ]}
          onBack={() => navigate('/roles')}
          showBack
        />

        <div className="role-permissions-page">
          <section className="role-permissions-section">
            <h2>Лаборатории и подразделения</h2>
            <p className="role-permissions-hint">
              Для каждой выбранной лаборатории или подразделения настраиваются свои права.
            </p>
            <Select
              mode="multiple"
              value={selectedValues}
              onChange={handleScopesSelectChange}
              placeholder="Выберите лаборатории или подразделения"
              loading={labsLoading}
              disabled={labsLoading}
              className="role-permissions-scope-select"
              listHeight={200}
              maxTagCount="responsive"
              allowClear
              optionFilterProp="label"
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={options.map(option => ({
                value: option.value,
                label: option.label,
              }))}
            />

            {scopes.length > 1 && (
              <div className="role-permissions-scope-tabs">
                {scopes.map(scope => {
                  const key = scopeBindingKey(scope);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={
                        key === activeScopeKey
                          ? 'role-permissions-scope-tab is-active'
                          : 'role-permissions-scope-tab'
                      }
                      onClick={() => setActiveScopeKey(key)}
                    >
                      {formatRoleScopeLabel(scope)}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {!activeScope && (
            <p className="role-permissions-hint">
              Выберите хотя бы одну лабораторию или подразделение, чтобы настроить права.
            </p>
          )}

          {activeScope && (
            <>
              <section className="role-permissions-section">
                <h2>Доступные вкладки</h2>
                <p className="role-permissions-hint">
                  Вкладки «Главная» и «Помощь» доступны всем. «Роли» и «Объекты испытаний» — только
                  администратору. Доступ к вкладке каталога даёт просмотр; создание, изменение и
                  удаление настраиваются ниже.
                </p>
                <div className="role-permissions-grid">
                  {CONFIGURABLE_NAVIGATION_KEYS.map(key => (
                    <Checkbox
                      key={key}
                      checked={permissions.navigation[key]}
                      onChange={event => toggleNav(key, event.target.checked)}
                    >
                      {NAVIGATION_LABELS[key]}
                    </Checkbox>
                  ))}
                </div>
              </section>

              <section className="role-permissions-section">
                <h2>Управление лабораториями</h2>
                <Checkbox
                  checked={permissions.laboratory_management.access}
                  onChange={event =>
                    updateActivePermissions(prev => ({
                      ...prev,
                      laboratory_management: { access: event.target.checked },
                    }))
                  }
                >
                  Разрешить управление лабораториями и методами исследования
                </Checkbox>
              </section>

              <section className="role-permissions-section">
                <h2>Поступление проб</h2>
                <p className="role-permissions-hint">
                  Обязательные поля всегда видимы: регистрационный номер, объект испытаний,
                  количество показателей, добавил пробу.
                </p>
                <div className="role-permissions-grid">
                  {SAMPLE_OPTIONAL_FIELDS.map(field => (
                    <Checkbox
                      key={field}
                      checked={permissions.samples.visible_fields.includes(field)}
                      onChange={event => toggleSampleField(field, event.target.checked)}
                    >
                      {SAMPLE_OPTIONAL_FIELD_LABELS[field]}
                    </Checkbox>
                  ))}
                </div>
                <div className="role-permissions-grid">
                  <Checkbox
                    checked={permissions.samples.update}
                    onChange={event =>
                      updateActivePermissions(prev => ({
                        ...prev,
                        samples: { ...prev.samples, update: event.target.checked },
                      }))
                    }
                  >
                    Редактирование проб
                  </Checkbox>
                  <Checkbox
                    checked={permissions.samples.delete}
                    onChange={event =>
                      updateActivePermissions(prev => ({
                        ...prev,
                        samples: { ...prev.samples, delete: event.target.checked },
                      }))
                    }
                  >
                    Удаление проб
                  </Checkbox>
                </div>
              </section>

              {CRUD_SECTIONS.map(section => (
                <section key={section.key} className="role-permissions-section">
                  <h2>{section.title}</h2>
                  <div className="role-permissions-grid">
                    {CRUD_ACTIONS.map(action => (
                      <Checkbox
                        key={action}
                        checked={permissions[section.key][action]}
                        disabled={!permissions.navigation[section.navigationKey]}
                        onChange={event =>
                          updateActivePermissions(prev => ({
                            ...prev,
                            [section.key]: {
                              ...prev[section.key],
                              [action]: event.target.checked,
                            },
                          }))
                        }
                      >
                        {CRUD_ACTION_LABELS[action]}
                      </Checkbox>
                    ))}
                  </div>
                </section>
              ))}

              <section className="role-permissions-section">
                <h2>Расчёты</h2>
                <div className="role-permissions-grid">
                  {(['execute', 'create', 'update', 'delete', 'show_equipment'] as const).map(
                    action => (
                      <Checkbox
                        key={action}
                        checked={permissions.calculations[action]}
                        onChange={event =>
                          updateActivePermissions(prev => ({
                            ...prev,
                            calculations: {
                              ...prev.calculations,
                              [action]: event.target.checked,
                            },
                          }))
                        }
                      >
                        {
                          {
                            execute: 'Проведение расчётов',
                            create: 'Сохранение',
                            update: 'Изменение',
                            delete: 'Удаление',
                            show_equipment: 'Поле «Приборы» при сохранении',
                          }[action]
                        }
                      </Checkbox>
                    )
                  )}
                </div>
              </section>

              <section className="role-permissions-section">
                <h2>Терминология отбора проб</h2>
                <RadioGroup
                  value={permissions.sampling_terminology}
                  onChange={event =>
                    updateActivePermissions(prev => ({
                      ...prev,
                      sampling_terminology: event.target.value as SamplingTerminology,
                    }))
                  }
                  options={(Object.keys(SAMPLING_TERMINOLOGY_LABELS) as SamplingTerminology[]).map(
                    key => ({
                      value: key,
                      label: SAMPLING_TERMINOLOGY_LABELS[key],
                    })
                  )}
                />
              </section>
            </>
          )}

          <div className="role-permissions-actions">
            <Button onClick={() => navigate('/roles')}>Отмена</Button>
            <Button
              type="primary"
              onClick={() => void handleSave()}
              loading={updateMutation.isPending}
            >
              Сохранить
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default RolePermissionsPage;
