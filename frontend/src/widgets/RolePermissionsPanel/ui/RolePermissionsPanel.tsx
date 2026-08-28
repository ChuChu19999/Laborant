import {
  CONFIGURABLE_NAVIGATION_KEYS,
  NAVIGATION_LABELS,
  SAMPLE_OPTIONAL_FIELDS,
  SAMPLE_OPTIONAL_FIELD_LABELS,
  SAMPLING_TERMINOLOGY_LABELS,
  formatRoleScopeLabel,
  scopeBindingKey,
  type SamplingTerminology,
} from '@/entities/Role';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { RadioGroup, Select } from '@/shared/ui/FormItems';
import { Layout } from '@/shared/ui/Layout';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import {
  CALCULATION_ACTION_LABELS,
  CALCULATION_ACTIONS,
  CRUD_ACTION_LABELS,
  CRUD_ACTIONS,
  CRUD_SECTIONS,
  useRolePermissionsPanel,
} from '../model/useRolePermissionsPanel';
import './RolePermissionsPanel.css';

/** Панель настройки прав роли по лабораториям и подразделениям. */
const RolePermissionsPanel = () => {
  const panel = useRolePermissionsPanel();

  if (panel.roleLoading || (panel.role && panel.draftSourceRoleId !== panel.role.id)) {
    return (
      <Layout title="Настройка прав">
        <LoadingCard loading />
      </Layout>
    );
  }

  if (!panel.role || panel.roleError) {
    return (
      <Layout title="Настройка прав">
        <div className="role-permissions-layout">
          <NavigationBar
            className="role-permissions-nav"
            breadcrumbs={panel.breadcrumbsNotFound}
            onBack={panel.navigateToRoles}
            showBack
          />
          <p className="role-permissions-error">Роль не найдена</p>
        </div>
      </Layout>
    );
  }

  const { permissions } = panel;

  return (
    <Layout title="Права пользователя">
      <div className="role-permissions-layout">
        <NavigationBar
          className="role-permissions-nav"
          breadcrumbs={panel.breadcrumbsForRole}
          onBack={panel.navigateToRoles}
          showBack
        />

        <div className="role-permissions-panel">
          <section className="role-permissions-section">
            <h2>Лаборатории и подразделения</h2>
            <p className="role-permissions-hint">
              Для каждой выбранной лаборатории или подразделения настраиваются свои права.
            </p>
            <Select
              mode="multiple"
              value={panel.selectedValues}
              onChange={panel.handleScopesSelectChange}
              placeholder="Выберите лаборатории или подразделения"
              loading={panel.labsLoading}
              disabled={panel.labsLoading}
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
              options={panel.options.map(option => ({
                value: option.value,
                label: option.label,
              }))}
            />

            {panel.scopes.length > 1 && (
              <div className="role-permissions-scope-tabs">
                {panel.scopes.map(scope => {
                  const key = scopeBindingKey(scope);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={
                        key === panel.activeScopeKey
                          ? 'role-permissions-scope-tab is-active'
                          : 'role-permissions-scope-tab'
                      }
                      onClick={() => panel.setActiveScopeKey(key)}
                    >
                      {formatRoleScopeLabel(scope)}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {!panel.activeScope && (
            <p className="role-permissions-hint">
              Выберите хотя бы одну лабораторию или подразделение, чтобы настроить права.
            </p>
          )}

          {panel.activeScope && (
            <>
              <section className="role-permissions-section">
                <h2>Доступные вкладки</h2>
                <p className="role-permissions-hint">
                  Вкладки «Главная» и «Помощь» доступны всем. «Роли» и «Объекты испытаний» — только
                  администратору. Доступ к вкладке каталога дает просмотр; создание, изменение и
                  удаление настраиваются ниже.
                </p>
                <div className="role-permissions-grid">
                  {CONFIGURABLE_NAVIGATION_KEYS.map(key => (
                    <Checkbox
                      key={key}
                      checked={permissions.navigation[key]}
                      onChange={event => panel.toggleNav(key, event.target.checked)}
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
                    panel.updateActivePermissions(prev => ({
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
                      onChange={event => panel.toggleSampleField(field, event.target.checked)}
                    >
                      {SAMPLE_OPTIONAL_FIELD_LABELS[field]}
                    </Checkbox>
                  ))}
                </div>
                <div className="role-permissions-grid">
                  <Checkbox
                    checked={permissions.samples.update}
                    onChange={event =>
                      panel.updateActivePermissions(prev => ({
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
                      panel.updateActivePermissions(prev => ({
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
                          panel.updateActivePermissions(prev => ({
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
                  {CALCULATION_ACTIONS.map(action => (
                    <Checkbox
                      key={action}
                      checked={permissions.calculations[action]}
                      onChange={event =>
                        panel.updateActivePermissions(prev => ({
                          ...prev,
                          calculations: {
                            ...prev.calculations,
                            [action]: event.target.checked,
                          },
                        }))
                      }
                    >
                      {CALCULATION_ACTION_LABELS[action]}
                    </Checkbox>
                  ))}
                </div>
              </section>

              <section className="role-permissions-section">
                <h2>Терминология отбора проб</h2>
                <RadioGroup
                  value={permissions.sampling_terminology}
                  onChange={event =>
                    panel.updateActivePermissions(prev => ({
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
            <Button onClick={panel.navigateToRoles}>Отмена</Button>
            <Button
              type="primary"
              onClick={() => void panel.handleSave()}
              loading={panel.updateMutation.isPending}
            >
              Сохранить
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default RolePermissionsPanel;
