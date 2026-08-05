import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Checkbox, Spin, message } from 'antd';
import { VisibilityScopeForm } from '../../entities/VisibilityScopeForm';
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
import { useUpdateRole } from '../../shared/model/hooks';
import Button from '../../shared/ui/Button';
import { RadioGroup } from '../../shared/ui/FormItems';
import Layout from '../../shared/ui/Layout';
import { NavigationBar } from '../../widgets/NavigationBar';
import type { RoleCatalogItem } from '../../shared/api/roles';
import type { VisibilityScope } from '../../shared/api/testObjects';
import './RolePermissionsPage.css';

const CRUD_SECTIONS: Array<{
  key: keyof Pick<RolePermissions, 'protocols' | 'equipment' | 'sampling_locations' | 'nd_norms'>;
  title: string;
  navigationKey: (typeof CONFIGURABLE_NAVIGATION_KEYS)[number];
}> = [
  { key: 'protocols', title: 'Протоколы', navigationKey: 'protocols' },
  { key: 'equipment', title: 'Приборы', navigationKey: 'equipment' },
  { key: 'sampling_locations', title: 'Места отбора проб', navigationKey: 'sampling_locations' },
  { key: 'nd_norms', title: 'Нормы НД', navigationKey: 'nd_norms' },
];

const CRUD_ACTIONS = ['create', 'update', 'delete'] as const;

const CRUD_ACTION_LABELS: Record<(typeof CRUD_ACTIONS)[number], string> = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
};

const RolePermissionsPage: React.FC = () => {
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();
  const updateMutation = useUpdateRole();
  const [role, setRole] = useState<RoleCatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<RolePermissions>(defaultRolePermissions());
  const [visibilityScope, setVisibilityScope] = useState<VisibilityScope>({
    laboratory_ids: [],
    department_ids: [],
  });

  const numericRoleId = useMemo(() => Number(roleId), [roleId]);

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
        setPermissions(
          syncCrudReadFromNavigation({
            ...(data.permissions || defaultRolePermissions()),
            navigation: {
              ...(data.permissions || defaultRolePermissions()).navigation,
              home: true,
            },
          })
        );
        setVisibilityScope({
          laboratory_ids: data.visibility_scope.laboratory_ids || [],
          department_ids: data.visibility_scope.department_ids || [],
        });
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

  const handleSave = useCallback(async () => {
    if (!role) {
      return;
    }
    const payload = syncCrudReadFromNavigation(permissions);
    try {
      await updateMutation.mutateAsync({
        id: role.id,
        data: {
          permissions: payload,
          visibility_scope: visibilityScope,
        },
      });
      navigate('/roles');
    } catch {
      // Ошибку показывает useUpdateRole / useMutation.
    }
  }, [role, permissions, visibilityScope, updateMutation, navigate]);

  const toggleNav = (key: (typeof CONFIGURABLE_NAVIGATION_KEYS)[number], checked: boolean) => {
    setPermissions(prev =>
      syncCrudReadFromNavigation({
        ...prev,
        navigation: { ...prev.navigation, home: true, [key]: checked },
      })
    );
  };

  const toggleSampleField = (field: string, checked: boolean) => {
    setPermissions(prev => {
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
                setPermissions(prev => ({
                  ...prev,
                  laboratory_management: { access: event.target.checked },
                }))
              }
            >
              Разрешить управление лабораториями и методами исследования
            </Checkbox>
            <div className="role-permissions-scope">
              <h3>Область видимости (пререход в лаборатории и подразделения)</h3>
              <VisibilityScopeForm value={visibilityScope} onChange={setVisibilityScope} />
            </div>
          </section>

          <section className="role-permissions-section">
            <h2>Поступление проб</h2>
            <p className="role-permissions-hint">
              Обязательные поля всегда видимы: регистрационный номер, объект испытаний, количество
              показателей, добавил пробу.
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
                  setPermissions(prev => ({
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
                  setPermissions(prev => ({
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
                      setPermissions(prev => ({
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
                      setPermissions(prev => ({
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
                setPermissions(prev => ({
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
