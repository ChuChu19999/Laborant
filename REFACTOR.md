# Журнал рефакторинга

Хронология по дате. Внутри даты: сначала **Backend**, затем **Frontend**; пункты в каждом слое — по возрастанию номера §. Нумерация §1–§116 сохранена для ссылок из чата и аудита.

---

## 28.08.2026

Основной рефакторинг FSD, слоёв backend, Ant Design theme, старт мониторинга.

### Backend

#### 29. API: один модуль на ресурс (ед. число в имени файла)

Переименование файлов роутеров без смены URL-тегов:

- `branches` → `branch`, `departments` → `department`, `laboratories` → `laboratory`
- `employees` → `employee`, `samples` → `sample`, `protocols` → `protocol`
- `protocol_templates` → `protocol_template` (отделён от protocols)
- `research_methods` / `research_method_groups` → `research_method` / `research_method_group`
- `sampling_locations` → `sampling_location`, `selection_conditions` → `selection_condition`
- `well_modes` → `well_mode`, `mass_fraction_oil` → `mass_fraction`

Регистрация в `api/__init__.py` через `include_router`; индекс — `services.meta.build_api_index` + `schemas.meta`; health — тонкий handler в api (`HealthResponse`, без service: нет бизнеса).

#### 30. Models: сущности в отдельных модулях

Из монолита `laboratory.py` вынесены:

- `models/branch.py`, `department.py`, `sampling_location.py`, `well_mode.py`
- `models/selection_conditions.py` (отдельно от laboratory)

Остальные модели приведены к тому же стилю индексов/связей; публичный импорт — `models/__init__.py`.

#### 31. Services / utils: пакеты по подсистемам

**Services:**

- `services/calculation/` — `service`, `compute`, `convergence`, `intermediate`, `chloride_salts`, `fractional_composition`, `mass_fraction_oil` (вместо разрозненных `calculator.py`, `chloride_salts.py`, `fractional.py`, …)
- `services/protocol/` — `service`, `generator`, `sample_map`, `template`, `template_excel`
- `services/sample/` — `service`, `export`, `excel`
- `services/ilninm_reports/` — сборка данных + `*_excel.py` (вместо `*_generator.py`); layout Excel — в utils
- отдельные CRUD-сервисы: `branch`, `department`, `employee`, `sampling_location`, `selection_condition`, `well_mode`, `user`, `meta`
- `research_methods_tree` вместо `saved_methods_tree`

**Utils (pure / SQL-хелперы):**

- `utils/calculation/`, `utils/protocol/`, `utils/sample/`, `utils/ilninm_reports/`
- плюс `equipment_display_rules`, `excel_typing` и пр.

Направление слоёв без изменений: api → services → repositories → models; flush в service/repo, commit только в `get_db`.

#### 32. Schemas / repositories под разрезанные сущности

Новые контракты: `schemas/branch`, `department`, `employee`, `sampling_location`, `selection_conditions`, `well_mode`, `fixtures`, `meta`.  
Новые repositories: `branch`, `department`, `sampling_location`, `well_mode` (+ правка `import-linter` independence).

Контракт ответов (цель): CRUD — ORM + `response_model`; составные — Pydantic из service (`build_*_response`); `*_name` / счётчики — `@computed_field` в schemas при eager load. Добивка простого CRUD до ORM — §36.

#### 33. Core

- `core/exception_handlers.py` — единая карта доменных ошибок → HTTP + безопасная сериализация для orjson.
- Правки `deps`, `database`, `exceptions`, `responses`, `security`, `middleware`, `swagger`, `hr_client`, `http_clients`, `logger`, `config`.

#### 34. Alembic: история схлопнута в initial

- Удалены все прежние revision-файлы.
- Одна миграция `alembic/versions/04bce01fbe1c_initial.py` (`down_revision = None`).
- Схема из `POSTGRES_DB_SCHEMA` через `SCHEMA = get_database_schema()`.
- Post-write hook `alembic_rewrite_schema.py` подставляет `SCHEMA` вместо хардкода имени схемы в autogenerate.
- Обновлены `alembic/env.py`, `script.py.mako`, `alembic.ini`.

#### 35. Tooling backend / документация

- `pyproject.toml`: ruff `ARG` + ignore-variadic-names; basedpyright — unused* как error, `reportImportCycles = none` для models; import-linter — новые repositories.
- `check.py` — единый прогон format/lint/types/слоёв (`python check.py` / `--fix`).
- `.gitignore` — `REFACTOR.md`.

#### §99. Мониторинг — health, период, аудит закрытия, путь онлайн (28.08.2026)

**Сделано:** реальная проверка PostgreSQL (`SELECT 1`, latency, ok/degraded/down) в `/api/health/` и сводке; период 24h/7d/30d для сводки и журнала; версия приложения в ошибках (клиент/сервер); reporter, user_agent в БД и модалке; heartbeat с `current_path`; закрытие с optional comment и `resolved_by_name`; сортировка по умолчанию — повторы; колонка «Версия»; очистка закрытых >90 дней; `services/health.py` (api не импортирует utils). Миграция `b2c3d4e5f6a7`.

### Frontend

#### 1. Сценарии → `features`

Модалки вынесены из `widgets/*/ui/...` и из вложенного `features/Modals/*` в плоские слайсы `features/<Name>Modal` (одно действие = feature, widget только compose):

- `CreateResearchMethodModal` (из `AdminWorkspace`)
- `DeleteResearchMethodModal` (из `AdminWorkspace` — скрытие метода / удаление группы)
- `FillCalculationsModal` (из `SamplesPanel`)
- `MassFractionOilRefractionDirectoryModal` (из `RefractionTablesPanel`)
- `SelectionConditionsModal` (из `LaboratoryManagement`)
- остальные Create/Edit/Delete* (Branch, Department, Laboratory, Sample, Protocol, Role, Equipment, NdNorm, TestObject, SamplingLocation, WellMode и т.д.)
- смежные сценарии: `SaveCalculationModal`, `GenerateReportModal`, `EquipmentDefaultModal`, `MethodologyVersionChoiceModal`, `EditProtocolTemplateModal`, `EditReportTemplateModal`

Импорты в виджетах — `@/features/...`. Старый каталог `features/Modals/` удалён.

#### 2. Оркестрация → `model`

Запросы, мутации, state и handlers вынесены из `ui` в `features/<name>/model/useXxxModal.ts`.

- У перенесённых модалок: `FillCalculationsModal`, `SelectionConditionsModal`, `MassFractionOilRefractionDirectoryModal` (+ у `CreateResearchMethodModal` model уже был).
- Добавлен `model` для всех Create/Edit без него (21 слайс): Branch, Department, Laboratory, NdNorm, Protocol, Role, Sample, SamplingLocation, TestObject, WellMode + EditEquipment и остальные Edit*.
- Delete* оставлены тонкими обёртками (одна мутация в `ui` — допустимо).

Виджеты list/CRUD: оркестрация в `widgets/<Panel>/model` (`useXxxPanel`, `useXxxPanelQueries`, `useXxxPanelModals`, `useXxxPanelQuerySync`, `useXxxPanelTableActions`); `ui` — сборка.

#### 3. Ant Design: theme ConfigProvider вместо `.ant-*` снаружи

- Расширен `ConfigProvider` theme в `app/App.tsx` (цвета статуса, disabled, Select.optionPadding, Message content).
- Убраны голые/глубокие `.ant-*` и кросс-слайсовые `.modal-wrapper:has(...)` из CSS entities/features/widgets.
- Стили кнопок/чеков — через собственные className; layout без копирования look библиотеки.
- В `App.css` оставлены только оверрайды, которых нет в theme (scrollbar virtual-list, позиция message, бренд clear-icon) с комментариями «почему CSS, а не theme».
- Осознанные исключения с комментарием: `UserPicker` (`.ant-input-suffix`), `ProtocolFormFields` (disabled option).

#### 4. Query keys: `reportKeys.available`

- В `entities/Report/api/reportKeys.ts` добавлен метод `available(laboratoryId, departmentId)` по тому же паттерну, что `protocolKeys.templates.available` (под `all`, не под `lists`).
- `useAvailableReportTemplates` переведён на фабрику вместо ручной сборки `[...reportKeys.lists(), 'available', ...]`.

#### 5. Удаление метода/группы → `features/DeleteResearchMethodModal`

- Сценарий скрытия метода / удаления группы вынесен из `AdminWorkspace` в тонкий Delete* feature (мутации в `ui`, как у остальных Delete*).
- Widget только держит `deleteTarget` / open и compose модалки; тексты подтверждения и вызов `useDeleteResearchMethod` / `useDeleteResearchMethodGroup` — в feature.

#### 6. React: убрать лишний `useCallback` / `useMemo` (добивка §2)

- `widgets/*/model/use*PanelModals.ts` — обычные функции вместо `useCallback` на `setState`.
- Все `features/Delete*Modal` — `handleConfirm` без `useCallback`.
- `features/EditReportTemplateModal/model` — хендлеры без `useCallback`.
- Таблицы Sample/Protocol/Equipment/NdNorm/TestObject/Role — константа `PAGE_SIZE_OPTIONS` вместо `useMemo`.
- Тривиальные `useMemo` убраны: `useLaboratoriesWithDepartments`, `useScopeAccess` (`EMPTY_SCOPES`), Create/Edit Protocol (`items`/`full_name`), SaveCalculation (`samples`).

#### 7. Ant Design: добивка §3 в `shared/ui`

- `FormItems.css` — убран дубль темы (`#1677ff` / шрифт / hover-focus); оставлены только layout multiple-tag и скрытие arrow при clear (с комментарием «почему CSS, а не theme»).
- `TableFilter` — `TableFilterTheme` (`ConfigProvider` с нейтральной theme); CSS без копирования look; строки фильтров обёрнуты в `TableFilterTheme`.
- `Modal.css` — убрана цепочка до `.ant-btn`; margin через `.button-wrapper > *`.

#### 8. Стили / a11y / анимации

- CSS-переменные позиции/цвета: Bubble, LoadingCard, UserPicker, RegistrationNumberPicker — через `ref.setProperty`, без `style={{}}` в JSX; ExcelEditor — классы ячеек; SideBar logo — `:hover` вместо `style.opacity`.
- Убраны/сужены transition на `height` / `left` / width в CreateResearchMethodModal, MainPage, SideBar.
- `FormulaKeyboard`: `23px` → `24px`.
- Кликабельные `div`/`img` → `button` или `role="button"` + клавиатура (SideBar, MethodListItem, SamplingLocations, CalculationsMethodsPanel, шаблоны, SaveCalculation, заголовки таблиц).
- ExcelEditor textarea: `:focus-visible` outline.

#### 9. Pages → тонкие оболочки + widgets

List/CRUD-экраны похудели до маршрута, guard прав и `return <XxxPanel />` (пример: `SamplesPage` ~20 строк вместо сотен). Логика экрана — в `widgets/*Panel` / `*Workspace`:

- `SamplesPanel`, `ProtocolsPanel`, `EquipmentPanel`, `NdNormsPanel`, `RolesPanel`, `RolePermissionsPanel`, `TestObjectsPanel`, `SamplingLocationsPanel`, `RefractionTablesPanel`
- `AdminWorkspace`, `CalculationsWorkspace`, `LaboratoryManagement`
- `SideBar` (навигация + сведения о пользователе)

Удалены монолитные page CSS/TSX и виджеты-дубли: `widgets/Tables/*`, отдельный `NavigationBar`/`UserInfo`/`MethodsPanel`/`CalculationPanel` как корневые widgets.

#### 10. UI по владельцу домена (entities / shared)

| Было | Стало |
|------|--------|
| `widgets/Tables/*` | `entities/<Entity>/ui/*Table` |
| `widgets/CalculationPanel` | `entities/Calculation/ui/CalculationPanel` |
| `entities/ExcelEditor` | `entities/Protocol/ui/ExcelEditor` |
| `entities/FormulaKeyboard` | `entities/Calculation/ui/FormulaKeyboard` |
| `entities/UserPicker` | `entities/Employee/ui/UserPicker` |
| `entities/MethodListItem` (+ Sortable) | `entities/ResearchMethod/ui/MethodListItem` |
| `entities/ConfirmationModal` | `shared/ui/ConfirmationModal` |
| `entities/Tables/CalculationsTable` и др. | `entities/Calculation` / `MassFractionOilRefraction` / `SelectionCondition` |
| `shared/ui/Cards` Laboratory/Department | `entities/Laboratory` / `entities/Department` |
| `features/Cards` (Error/Loading) | `shared/ui` |
| `features/FormItems` | `shared/ui/FormItems` (+ `FormItem`) |
| `widgets/NavigationBar`, `SplitPanel`, `ThreePanel` | `shared/ui/*` |
| `widgets/UserInfo` | свёрнут в `SideBar` |

Entities без «осиротевших» UI-слайсов: только доменные слайсы (`Branch`, `Sample`, `Protocol`, …) с `api` / `model` / `ui`.

#### 11. App / shared инфраструктура

- `app/auth` — guards, wiring, `/me`; `app/layouts` — `AppLayout`; `lazyPages` + `preloadPages` (code-split страниц).
- Удалены `app/Content`, `app/data.tsx`.
- `shared/model`: `useUrlSync`, `usePageState`, обёртки `useQuery` / `useMutation` с invalidate и тостами.
- `shared/lib`: keycloak, http, notify, routing, table, validation, xlsx, formatting, errors, zustand.
- Иконки: убраны `@mui/*` и `@emotion/*`; обёртки в `shared/ui/icons` (+ React Icons / Lottie).
- Tooling: Steiger (`steiger.config.ts`, границы FSD), Prettier в `npm run fix`, `lint` = eslint + steiger + tsc; версия frontend `1.0.4`; опционально `build:analyze`.

#### 12. Frontend: добивка a11y / antd / React (хвосты §3, §6, §7, §8)

- `App.tsx` — `Button.dangerColor: '#ff4d07'`; в `Button.css` оставлен только border outlined danger с комментарием «почему CSS» (не `colorError`, чтобы не затронуть Form/Alert).
- `TablePagination` — look page-size Select через локальный `ConfigProvider` theme (как `TableFilterTheme`); `.ant-select-*` из CSS убраны.
- `FormItemWrapper.css` — комментарий «почему CSS» для размера `.ant-checkbox-inner`.
- `Modal` — закрытие через `<button>` + `aria-label` + `:focus-visible`; проп `style` с собственной разметки снят (и у `ConfirmationModal`).
- `ExcelEditor` — `.toolbar-btn:focus-visible` (в дополнение к textarea из §8).
- Убраны тривиальные `useCallback` / `useMemo`: `ResetFiltersButton`, `VisibilityScopeForm` (`selectedValues`), `SelectionConditionsForm` (`formatValue`).

**Критерий «feature vs панель» (зафиксирован):** модальный сценарий с одним намерением с экрана-родителя и одним основным потребителем-виджетом остаётся в `features`, даже если внутри шаги и локальный CRUD. В `widgets` — блоки экрана маршрута; в `entities/*/ui` — только если тот же UI открывают 2+ виджета. Перенос в `widgets` — только вместе с compose на `pages` (запрет widget→widget в FSD). По этому критерию в `features` остаются: `CreateResearchMethodModal`, `SaveCalculationModal`, `FillCalculationsModal`, `SelectionConditionsModal`, `MassFractionOilRefractionDirectoryModal`, `EditProtocolTemplateModal`, `EditReportTemplateModal`.

**Явно не входило в эту добивку:** массовый перевод типографики на `rem`, массовое выравнивание отступов под шкалу.

#### 13. Frontend: хвосты §1 / §6 / §8 / public API

- Удалён мёртвый дубль `widgets/AdminWorkspace/ui/CreateResearchMethodModal/` (§1: импорт уже шёл из `@/features/CreateResearchMethodModal`).
- Добиты тривиальные `useCallback` / `useMemo` (§6): Create/Edit model-хуки, `EditProtocolTemplateModal`, `FillCalculationsModal`, `SaveCalculationModal`, `EquipmentDefaultModal`, `SelectionConditionsModal`, `MassFractionOilRefractionDirectoryModal`; в widgets — `totalPages`, `navigateHome` / `closeModal` / клики навигации, `SideBar` (кроме нетривиального `navigateTo`), `CalculationsWorkspace`, `AdminWorkspace`, `SamplingLocationsPanel*`.
- Хвосты §8 без `style={{}}` на своей разметке: снят проп `style` у `UserPicker` / `RegistrationNumberPicker`; `SortableMethodListItem` — CSS-переменные через `ref.setProperty`.
- a11y: `Layout` — настройки через `<button>` + `aria-label` + `:focus-visible`; `ExcelEditor` ячейка — `role="gridcell"` + `tabIndex` + Enter/Space + `:focus-visible`.
- Public API shared: `icons.css` подключён из `shared/ui/icons/index.ts` (убраны глубокие импорты); `logoImage` и `fonts.css` — через `shared/assets/index.ts`.

#### 14. Frontend: data-layer хвосты (entity-hooks, FSD imports)

Добивка после §1–2 / §10: feature/widget больше не зовут `*Api` напрямую — только entity-hooks; внутри слайса Calculation — относительные импорты.

- `entities/ResearchMethod`: `useSavedMethodsTree`, `useFixtureDirectories` (+ расширен `useFixtureQueries`); `useResearchMethodsForGroupCreate`, `useResearchMethodQueries` (`fetchResearchMethod`, `laboratoryHasResearchMethods` с notify при ошибке).
- `entities/Sample`: `useSampleQueries` (`fetchSamplesByRegistrationNumber`).
- `entities/Calculation`: `useCalculationQueries` (`fetchCalculationsBySampleIds`); в `useCalculationPanel` / `CalculationPanel` убран самоимпорт `@/entities/Calculation`.
- `CreateResearchMethodModal`: `useFixturePrefill` и список методов для группы — через entity-hooks (не `fixturesApi` / `researchApi`).
- `AdminWorkspace` / `LaboratoryManagement`: вместо локальных `useAdminRegistrationData` / `useLaboratoryHasMethods` — `useSampleQueries` + `useCalculationQueries` / `useResearchMethodQueries`; тонкие widget-обёртки удалены.
- `useUrlSync`: комментарий «почему» у `eslint-disable` exhaustive-deps при монтировании.

#### 15. Frontend: права без Outlet + мёртвый код / CSS-хвосты

Добивка после аудита; без смены решений §3 / §10 / §12 (толстые модалки в `features`, `@x` по владельцу UI, осознанные `.ant-*`).

- Права: `useOutletContext` убран из `entities/Role`. Добавлены `PermissionsContext` + hooks; value задаёт `app/layouts/AppLayout` после `/me`. `useCan` / `useScopeAccess` / `usePermissionsContext` читают React Context. `MainPage` / `HelpPage` переведены на тот же контекст. (Обёртка Provider позже вынесена в `app` — §37.)
- Удалён мёртвый `Can`.
- `MassFractionOilColorField` импортирует `ParallelCard.css` (классы больше не зависят от побочного монтирования `ParallelCard`).
- Мёртвый public API: `shared/ui/Tour`, alias `FormWrapper` и неиспользуемый `FormItemWrapper` (+ CSS), реэкспорт `CloseCircleFilled`.
- Пустые className без селекторов: `loading-text`, `range-calculation-section`, `ranges-container`, `research-method-select`.

#### 16. Frontend: добивка аудита (права UI / public API / CSS карточек)

Хвосты после §15 и сверки с решениями §3 / §7 / §10 / §12; без отката осознанных исключений (antd CSS, FormulaKeyboard в Calculation, Modal `.button-wrapper > *`, mobile-first вне скоупа).

- `minimize` убран из `PermissionsContextValue`. Свёртка сайдбара: `AppLayout` → `Outlet context={{ sidebarCollapsed }}`; `MainPage` читает через `useOutletContext` (только layout UI, не права).
- Мёртвый код Role: удалён `visibilityScope.ts` (`isScopeUnrestricted` / `isVisibleInScope` / `isLaboratoryCardAccessible`); убран `emptyPermissionsFallback`; из public API `Role` сняты неиспользуемые снаружи `checkPermission`, `canAccess*`, `mergePermissions` (остались внутри слайса для hooks).
- Public API Calculation: снаружи убраны `calculationApi` и `useRegistrationNumberSearch` (потребители — entity-hooks / относительные импорты внутри слайса).
- `LaboratoryCard` / `DepartmentCard`: убрана лишняя обёртка `div.button-wrapper` поверх `Button`; flex через scoped `.laboratory-card-actions .button-wrapper` / `.department-card-actions .button-wrapper`.

#### 17. Frontend: кросс-слайсовый CSS / префиксы классов / мёртвый public API

Добивка после повторного аудита; без отката §3 / §7 / §10 / §12.

**Кросс-слайсовый CSS → пропсы владельца:**
- `CalculationsTable` — `variant="modal"`; стили модалки в `CalculationsTable.css` (`--modal`); `FillCalculationsModal` больше не трогает `.calculations-table*`.
- `CalculationPanel` — `fillParent`; flex-высота в `CalculationPanel.css` (`--fill`); `CalculationsWorkspace` не стилизует `.calculation-panel*`.
- `NavigationBar` — `className`; `RolePermissionsPanel` / `CalculationsWorkspace` стилизуют свои классы (`role-permissions-nav`, `calculations-page-nav`).
- `Layout` — `contentClassName`; `SplitPanel` — `className` + `hideLeft` (режим редактирования расчёта в shared CSS).

**Префиксы глобальных классов** (без коллизий между слайсами): CreateResearchMethodModal, EditProtocol/ReportTemplateModal, SelectionConditionsModal, MassFractionOilRefractionDirectoryModal, LaboratoryManagement, ExcelEditor (`.table-container` → `.excel-editor-table-container`).

**Мёртвый код удалён:** `useAvailableReportTemplates`, `useEquipmentById`, `useProtocol`, `useDeleteSelectionConditions`, `useUpdateResearchMethodSortOrder` / `useUpdateResearchMethodGroup`, create/update/delete refraction table (оставлен bulk), `formatVisibilityScopeDisplay`, `getResearchMethodIntermediateFields`.

**Public API сущностей:** из `index.ts` сняты все `*Api` и лишние `*Keys` / `useCalculate`; снаружи оставлены только `branchKeys`, `samplingLocationKeys`, `wellModeKeys` (invalidate в `SamplingLocationsPanel`). Модули `api/` сохранены для внутренних импортов.

#### 18. Frontend: хвост §3 — `.anticon` → собственные className

Добивка после аудита: голые `.anticon` вне списка осознанных исключений §3 заменены на className иконки (без отката `UserPicker` / `ProtocolFormFields` / `App.css` / Modal §7).

| Было | Стало |
|------|--------|
| `DepartmentCard` / `LaboratoryCard` — `.…-settings-button .anticon` | `SettingOutlined className="…-settings-icon"` + CSS класса |
| `MethodListItem` — `.method-list-item-edit .anticon` | `EditOutlined className="method-list-item-edit-icon"` |
| `AdminWorkspace` — `.admin-page-button-settings .anticon` | `SettingOutlined className="admin-page-button-settings-icon"` |
| `ExcelEditor` toolbar — `.toolbar-btn … .anticon` | `className="toolbar-btn-icon"` на Bold/Italic/Download |

Осознанные исключения без изменений: `UserPicker` (`.ant-input-suffix` / `.anticon` у clear), `ProtocolFormFields` (disabled option), глобальные оверрайды `App.css`, селектор Modal `.button-wrapper > *`.

#### 19. Frontend: мёртвый public API / `@x` / именование `Menu`

Добивка после аудита; **без отката** §1 / §12 / §15 (толстые модалки в `features`, права через Context в `Role`, осознанные `.ant-*` / `App.css`). (Wiring Provider → `app` — §37.)

**Public API сущностей** — из `index.ts` сняты реэкспорты, которые снаружи не импортируются (модули внутри слайса / `@x` сохранены):

| Слайс | Убрано снаружи |
|-------|----------------|
| `Employee` | `useEmployeesByHsnils`, `useEmployeeSearch`, `EmployeeBrief`, `EmployeePhoto` |
| `Laboratory` | `VisibilityScopeForm`, `VISIBILITY_*_PREFIX`, `visibilityScopeToSelectValues`, `selectValuesToVisibilityScope`, `VisibilityScopeOption`, `LaboratoryWithDepartments` (оставлен `buildVisibilityScopeOptions`) |
| `SelectionCondition` | `SelectionConditionsForm` (остаётся через `@x/Sample`) |
| `Sample` | `SampleProtocol`, `formatWellDisplay`, `WELL_DISPLAY_PREFIX` |
| `Calculation` | `CalculateRequest`, `IntermediateResultValue`, `EquipmentBrief`, `CalculationFilters`, `MethodologyChoiceCandidate` |
| `ResearchMethod` | дубли `@x`/внутрянка: `useResearchMethodsByIds`, convergence/rounding/chloride helpers, `MASS_FRACTION_OIL_GROUP_NAME`, `enrichGroupMethodsWithSortOrder`, fixture entry-типы, `ResearchMethodGroupCreate`, `ResearchMethodIdentityFormValues`, `ResearchMethodsQueryState` |
| `Role` | `NAVIGATION_KEYS`, `NAVIGATION_PATH_MAP`, `ROLE_TYPE_OPTIONS`, `RoleTypeValue`, `PermissionsContextValue`, `VisibilityScopeEntity`, `SAMPLE_REQUIRED_FIELDS`, `ConfigurableNavigationKey`, `CrudPermissions`, `NavigationPermissions`, `SampleOptionalField` |

**`@x`:** `Role/@x/Laboratory` и `Role/@x/TestObject` — только `VisibilityScope` (убраны неиспользуемые потребителем типы).

**Именование:** `shared/ui/menu` → `shared/ui/Menu` (+ импорты).

#### 20. Frontend: хвост public API / NavigationBar / CalculationPanel date

Добивка после сверки аудита с решениями §1 / §3 / §12 / §16 / §17 / §19; **без отката** толстых модалок в `features`, осознанных `.ant-*` и scoped `.button-wrapper` у карточек.

**Мёртвый public API** — из `index.ts` сняты реэкспорты, которые снаружи не импортируются (модули внутри слайса сохранены):

| Слайс | Убрано снаружи |
|-------|----------------|
| `Calculation` | `CalculationPanelProps` |
| `TestObject` | `TestObjectsQueryState`, `buildSampleTypeOptionsFromCatalog`, `SampleTypeOption` |
| `Equipment` | `EquipmentMethodOption`, `EquipmentQueryState` |
| `Sample` | `SampleFormSelectOption`, `SamplesQueryState` |
| `Protocol` | `ProtocolTemplateOption`, `ProtocolsQueryState` |
| `NdNorm` | `NdNormsQueryState` |
| `Role` | `RolesQueryState` |
| `Report` | `ReportType` |
| `FillCalculationsModal` / `MassFractionOilRefractionDirectoryModal` / `SelectionConditionsModal` | реэкспорт `*Props` (тип остаётся внутренним для `createLazyFeature`) |

**Хвост §17 NavigationBar:**
- Удалены мёртвые селекторы `.departments-container` / `.laboratories-container` (классов в разметке больше нет).
- Позиционирование `.content > .navigation-bar` перенесено в `Layout.css` (владелец `layout-wrapper`).

**CalculationPanel:** DatePicker без чужого класса `date-picker` / `date-picker-error` — только `calculation-panel-date-picker` (+ `-error`).

**Осознанно не трогали (как §18 / Modal §7):** scoped `.…-actions .button-wrapper` и `.wax-precipitation-wrapper .form-item-container` — flex/gap у обёртки shared Button/FormItem через родителя слайса; не кросс-слайс «снаружи», а compose с public className обёртки.

#### 21. Frontend: хвост public API — `*Create` / `*Update` / `*ListParams` / DTO

Добивка после §19 / §20: из `entities/*/index.ts` сняты реэкспорты DTO, которые снаружи не импортируются (модули `api/` и внутренние импорты слайса сохранены). Без отката §1 / §12 (толстые модалки в `features`).

| Слайс | Убрано снаружи |
|-------|----------------|
| `Branch` | `BranchCreate`, `BranchUpdate`, `BranchListParams` |
| `Department` | `DepartmentCreate`, `DepartmentUpdate` |
| `Laboratory` | `LaboratoryCreate`, `LaboratoryUpdate` |
| `Role` | `RoleUpdate` |
| `WellMode` | `WellModeCreate`, `WellModeUpdate`, `WellModeListParams` |
| `TestObject` | `TestObjectSelectItem`, `TestObjectUpdate` |
| `NdNorm` | `NdNormMethodDataItem` |
| `Report` | `ReportTemplate`, `ReportTemplateCreate`, `ReportTemplateUpdate` |
| `SelectionCondition` | `SelectionConditions`, `SelectionConditionsCreate`, `SelectionConditionsUpdate`, `SelectionConditionsField` (поле остаётся через `@x/Sample`) |
| `SamplingLocation` | `SamplingLocationCreate`, `SamplingLocationUpdate`, `SamplingLocationListParams` |
| `MassFractionOilRefraction` | `MassFractionOilRefractionTable`, `…Create`, `…Update`, `BulkUpdateRequest` |

Оставлены снаружи типы, которые реально импортируют features/widgets (`Branch`, `NdNormCreate`, `SampleCreate`, `RoleCreate`, `TestObjectCreate`, `ProtocolFilters` и т.п.).

#### 22. Frontend: URL-sync филиала / Tour / исключения UI entities

Добивка после сверки аудита с §10 / §12; **без отката** толстых модалок в `features` и осознанных `.ant-*` / `App.css`.

- `SamplingLocationsPanel`: `selectedBranch` синхронизируется с URL (`?branchId=`): restore из query, запись при выборе/автовыборе, сброс при смене lab/dept; логика в `useSamplingLocationsPanelSelection`.
- Удалены остатки мёртвого `shared/ui/Tour/` (пустая папка после §15).
- Зафиксированы исключения «UI сущности при одном потребителе» (как у `FormulaKeyboard`): `RegistrationNumberPicker` остаётся в `entities/Calculation`, `ExcelEditor` — в `entities/Protocol` (владелец домена по §10; не переносить в feature/widget без отдельного решения).

#### 23. Frontend: безопасность keycloak / public API api-сегмента / URL-sync workspace

Добивка после аудита frontend на соответствие rules; **без отката** §12 (толстые модалки в `features`), §3 / §22 (осознанные `.ant-*`, `App.css`, UI-исключения entities).

**Безопасность — JWT в консоль убран:**
- `shared/lib/keycloak/keycloakService.ts`: удалены `console.log` содержимого/ролей токена и метод `logTokenForAnalysis`; оставлены только `console.error` при сбое refresh (без дампа JWT).

**Public API — явные реэкспорты в `entities/*/api/index.ts`:**
- Во всех 17 слайсах `export * from './…'` заменён на явный список типов, `*Api` и `*Keys` (внутренний barrel для `model` → `../api`; slice-level `index.ts` чистился ранее в §19–21).

**URL-sync — правило для workspace (зафиксировано):**

| Уровень | Куда | Инструмент |
|---------|------|------------|
| list-panel (фильтры, page, sort) | query | `useUrlSync` + zustand store |
| workspace scope (lab / dept / sample) | path | `useParams` |
| устойчивый выбор внутри экрана | query точечно | узкий хук selection (не `useUrlSync`) |
| модалки, drag, draft | memory | `useState` |

- `AdminWorkspace`: `selectedMethodId` ↔ `?methodId=` — `widgets/AdminWorkspace/model/useAdminWorkspaceMethodSelection.ts` (restore / автовыбор / сброс при смене lab-dept / reselect после удаления метода из списка); автовыбор первого метода вынесен из `useAdminWorkspace`.
- `CalculationsWorkspace` — уже по правилу: path + `sampleId` / `editCalculationId` в query.
- `RefractionTablesPanel` — path для lab/dept; выбор метода и модалка в state (deep link на справочник не требуется).

#### 24. Frontend: a11y форм / parseSearchParamInt / ExcelEditor ConfigProvider

Добивка хвостов аудита после §8 / §12 / §23; **без отката** толстых модалок в `features`, Context/хуков прав в `entities/Role`, px-типографики. (Wiring Provider → `app` — §37.)

**Связка label ↔ поле:**
- `shared/ui/FormField` — render-prop `(fieldId, labelId)`; режимы `control` (htmlFor) и `group` (aria-labelledby для upload/составных блоков).
- `shared/ui/FormItem` — заголовок через `<label htmlFor={controlId}>`, `id` пробрасывается в child через `cloneElement`.
- Переведены на `FormField`: `*FormFields` (Branch, Department, Laboratory, SamplingLocation, WellMode, Role, TestObject); модалки GenerateReport, SaveCalculation, EditReport/ProtocolTemplate.
- `UserPicker` — проп `id` на внутренний `Input`.

**URL-парсинг:**
- `parseSearchParamInt` — в `shared/lib/routing/urlParams.ts`; `CalculationsPage` и `CalculationsWorkspace` импортируют из `@/shared/lib/routing`; удалён `widgets/CalculationsWorkspace/lib/parseSearchParamInt.ts`.

**Ant Design в entity без прямого импорта:**
- `shared/ui/AntdWavelessProvider` — локальный `ConfigProvider wave={{ disabled: true }}` для toolbar `ExcelEditor` (вместо `antd` в `entities/Protocol`).

**Осознанно оставлено:**
- `HelpPage` — `<a>` без `href` у «системы поддержки пользователей» (нет URL поддержки; не плодить пустую ссылку).

#### 25. Frontend: добивка аудита — мёртвый дубль / импорт CSS / a11y label (хвост §13 / §15 / §24)

Добивка после сверки кода с §13 / §15 / §24; без отката §12 (толстые модалки в `features`), px-типографики, `HelpPage` `<a>` без `href`.

**Мёртвый код:**
- Удалён неиспользуемый дубль `widgets/AdminWorkspace/ui/CreateResearchMethodModal/` (§13: импорт уже шёл из `@/features/CreateResearchMethodModal`).

**Сборка:**
- `MassFractionOilColorField` — импорт `./ParallelCard/ParallelCard.css` вместо неверного `../ParallelCard/ParallelCard.css` (§15; `vite build` падал).

**a11y — связка label ↔ поле (закрыт хвост §24):**
- Голые `<label>` без `htmlFor` заменены на `FormField` (+ `id` на control / `labelMode="group"` для составных блоков): `SampleFormFields`, `ProtocolFormFields`, `EquipmentFormFields`, `NdNormFormFields`, `SelectionConditionsForm`, `ResearchMethodFormFields`.
- Секции `CreateResearchMethodModal`: `InputDataFieldsSection`, `MainFormulaSection`, `RoundingSection`, `MeasurementErrorSection`, `ConvergenceConditionsSection`, `IntermediateFieldItem`, `ResearchMethodGroupForm`, `ResearchMethodFixturePrefill`.
- `FormulaInput` — проп `id`, пробрасывается в `Input`.

#### 26. Frontend: хвост React Query §14

Добивка после §14; verify: `npm run lint` OK.

**React Query (VERIFIED):**
- `entities/ResearchMethod`: `useLaboratoryHasResearchMethodsQuery(laboratoryId, enabled)` — декларативный `useAutoRefetchQuery` вместо `laboratoryHasResearchMethods` + `fetchQuery`.
- `widgets/LaboratoryManagement/model/useLaboratoryManagement.ts`: убран `useEffect` → `openLaboratoryWithoutDepartments` → `fetchQuery`; probe через hook + effect только для navigate при `total > 0`.
- Из `useResearchMethodQueries` удалён `laboratoryHasResearchMethods`; `fetchResearchMethod` сохранён.

#### 27. Frontend: хвост аудита — CreateAnimatedAntdIcon / validation / lib barrel

Добивка после сверки с §8 / §12 / §19; **без отката** толстых модалок в `features` (критерий §12; повторный аудит с требованием переноса в `widgets` — отклонять).

**Стили (хвост §8):**
- `shared/ui/icons/CreateAnimatedAntdIcon.tsx`: с `motion.span` снят проброс `style` (потребители передают только `className`, напр. `animated-icon`); `style` у antd `Icon` (`fontSize`) — допустимое исключение.

**Мёртвый код:**
- `shared/lib/validation/inputValidation.ts`: удалён неиспользуемый `preserveCursorPosition` (`validateNumericInputWithComma` — в `ParallelCard`).
- `features/CreateResearchMethodModal/lib/index.ts`: убраны re-export `mapIntermediateFieldFromApi`, `serializeIntermediateFieldForApi`, `formatSavedMethodTreeTitle`, `savedLaboratoryKey` (используются только внутри `formMapping.ts` / `fixtureTree.ts`).

Verify: `npm run lint` OK.

#### 28. Frontend: хвосты available-шаблонов / menu / useCallback

Добивка после сверки REFACTOR с кодом; **без смены** контракта Report `available` (`include_deleted=True` на backend — как задано).

**Report / Protocol templates select:**
- Восстановлен `useAvailableReportTemplates` на `reportKeys.available`; `EditReportTemplateModal` переведён с paginated `list` на `available` (полный список без пагинации). Фильтр `!deleted_at` в модалке сохранён: select показывает только активные; backend `include_deleted` не менялся.
- `EditProtocolTemplateModal`: `useProtocolTemplates` → `useAvailableProtocolTemplates`; backend `available` — `include_deleted=True` + обязательный `laboratory_id` (как Report); select фильтрует `!deleted_at` на UI.

**Мёртвый дубль / React:**
- Удалён `shared/ui/menu/` (импорты уже на `shared/ui/Menu`, §19).
- Убраны тривиальные `useCallback` в `useFixturePrefill` и `useGenerateReportModal` (§6 / §13).

#### §100. Мониторинг — UI health, чипы онлайн, heartbeat (28.08.2026)

**Сделано:** карточка «Статус работоспособности сервиса» (статус + подпись PostgreSQL · latency); чипы онлайн — скругление 6px, путь на второй строке; `usePresenceHeartbeat` — `window.location.pathname` вместо `useLocation`; `FEATURES.md` обновлён.

#### §101. Мониторинг — модалка примечания при закрытии/открытии (28.08.2026)

**Сделано:** `MonitoringErrorStatusModal` — при «Закрыть»/«Открыть» в таблице и из деталей; необязательное примечание; при открытии дописка «Открыто снова: …» в `resolve_comment`, аудит закрытия не сбрасывается. Компакт: `modalWidth="450"`, 2 строки, без отдельного заголовка поля.

---

## 31.08.2026

Добивка после сверки с кодом, self-check, UI-хвосты, мониторинг.

### Backend

#### 36. Хвосты после сверки REFACTOR с кодом

Добивка после аудита «написано как сделано, но не доделано»; без смены §12 / enriched-контрактов.

**Backend — простой CRUD → ORM + `response_model` (закрыт хвост §32):**
- Убраны `build_*_response` / `*_for_response`, которые только делали `model_validate`: branch, department, laboratory, well_mode, sampling_location, selection_condition, nd_norm, equipment, protocol_template, report template, research_method / group, mass_fraction; sample get/create/update.
- api возвращает ORM; сериализация через `response_model` + `@computed_field` при eager load.
- **Оставлены enriched** (`build_*_response`): protocol, calculation, role (scopes labels), test_object (visibility_scope labels); sample list / registration numbers (protocols batch).
- health не выносился в `services.meta` (YAGNI); формулировка §29 уточнена.

#### 39. Backend: `OptionalNonEmptyStr` + `max_length` (500 на Response)

Симптом: `POST /api/laboratories/` создавал ORM, затем 500 при сериализации `LaboratoryResponse`: `Unable to apply constraint 'max_length' to supplied value None` (поле `laboratory_location=None`).

Причина (Pydantic V2): `Annotated[OptionalNonEmptyStr, Field(max_length=N)]` навешивает `max_length` на union `str | None`, и валидатор вызывает `len(None)`.

Исправление: `max_length` только в `Field(..., max_length=N)` на поле с типом `OptionalNonEmptyStr` (ограничение не применяется к `None`). То же во всех Update/опциональных полях schemas: laboratory, branch, department, equipment, nd_norm, protocol, report, research, role, sample, sampling_location, test_object, well_mode. Комментарий-правило — в `schemas/common.py` у `OptionalNonEmptyStr`.

Verify: `LaboratoryResponse.model_validate` с `laboratory_location=None` OK. Общий паттерн — `optional_string_constraints` + `self_check` в `~/.cursor/rules/03-backend.mdc`; проектные исключения — `project_agreements` в `02-global-principles.mdc`.

#### 40. Backend: self-check до старта (по слоям)

Пакет `self_check/` — отдельный модуль на слой + общий раннер:

| Модуль | Что проверяет |
| --- | --- |
| `api.py` | нет commit / httpx / models / repositories / utils / legacy query / NotFoundError в api |
| `core.py` | нет api/services/repositories/schemas вне `deps.py`; commit только в `database.py` + наличие `get_db`; httpx только в `*client*` |
| `models.py` | Mapped-quote bug, `__allow_unmapped__`, `@property *_name/_count`, PG ENUM / `mapped_column(Enum)`, запрет fastapi/httpx/верхних слоёв |
| `repositories.py` | commit / HTTP / fastapi / верхние слои / доменные raise; независимость repos (только `repositories.base`) |
| `schemas.py` | static (Optional+max_length Annotated, Pydantic V1, импорты) + **runtime** nullable constraints (`schemas_runtime.py`) |
| `services.py` | commit / HTTPException / fastapi / httpx / api / core.deps / core.responses / legacy query; **AST:** `update_*` после `flush_entity` без re-fetch ORM |
| `utils.py` | commit / HTTP / fastapi / httpx / services / api / repositories / core (кроме `core.logger`) / доменные raise |

- `assert_all_self_checks()` в `main.py` lifespan и шаг `python check.py`.
- Отчёт группирует ошибки по слою (`[api]`, `[core]`, …).

Не ловит: бизнес-правила, БД, внешние API, `@IsAuthenticated` (декораторы закомментированы — intentional_do_not_touch).

Verify: `python check.py` OK.

#### 55. Backend/Frontend: стили шапки шаблона не сохранялись / не показывались

- При сохранении Excel `ExcelCellStyle.model_dump()` из‑за `serialize_by_alias=True` отдавал `fontWeight`/`fontSize`, а `apply_header_section_edits` читал `font_weight`/`font_size` — жирный/курсив/кегль не писались в xlsx (и затирались при сохранении). Исправлено: `model_dump(by_alias=False)` + чтение обоих вариантов ключей.
- Фронт: `normalizeCellStyles` при загрузке; в ExcelEditor усилены CSS для bold/italic/font-size; у модалки снят принудительный `font-size: 14px` на всех `div/span`.

#### 56. Backend: PATCH — ResponseValidationError после flush (updated_at)

**Симптом:** PATCH CRUD (первый — `/departments/{id}/`) → 500, `ResponseValidationError` на `updated_at`; логгер падал на `str(exc)` из‑за ORM в `errors()` → detached `__repr__`.

**Причина:** после `flush` колонка `updated_at` (`onupdate=func.now()` в `BaseModel`) обновляется в БД, но атрибут в ORM протухает; при сериализации `*Response` через `from_attributes` в async — `ResponseValidationError` / `MissingGreenlet`.

**Исправление — перечитывание после `flush_entity` в `update_*`:**

| Сервис | Функция |
|--------|---------|
| `department` | `update_department` |
| `laboratory` | `update_laboratory` (+ восстановлен `delete_laboratory`, сломанный при прошлой правке) |
| `branch` | `update_branch` (+ восстановлен `delete_branch`) |
| `well_mode` | `update_well_mode` |
| `sampling_location` | `update_sampling_location` |
| `selection_condition` | `update_selection_conditions` |
| `nd_norm` | `update_nd_norm` (всегда re-fetch, не только при смене lab/dept) |
| `report` | `update_report_template` (ветка без замены файла) |
| `protocol/template` | `update_protocol_template` |
| `research` | `update_research_method`, `update_research_method_sort_order` |
| `protocol/service` | `update_protocol` |
| `calculation/service` | `update_calculation` |

Паттерн: `await flush_entity(db)` → `return await require_<entity>_by_id(db, entity.id)`.

Уже безопасно без этой правки: `role`, `test_object` (`refresh_entity`); `equipment`, `mass_fraction`, create-ветки с re-fetch; `update_research_method_group`. `sample` — исправлено в §70 (частичный `db.refresh` ломал `updated_at`).

**Инфраструктура ошибок:**
- `core/exception_handlers.py` — handler `ResponseValidationError`, `_safe_exc_message`, безопасный `_json_safe_value`.
- `main.py` — регистрация handler.
- `models/department.py` — устойчивый `__repr__`.

**Rules:** зафиксировано в `~/.cursor/rules/03-backend.mdc` (`services.mutations.after_update_return`, уточнение `transaction_model.refresh` / `repositories.refresh_entity`), `project_agreements` в `02-global-principles.mdc`, `consistency_checks` в `05-assistant-behavior.mdc`.

#### 57. Backend: Ruff BLE001 в exception_handlers / Department.__repr__

Хвост §56: `python check.py` падал на Ruff — `except Exception` (BLE001) в защитных fallback'ах.

- `core/exception_handlers.py`: кортеж `_SAFE_FALLBACK_ERRORS` (`AttributeError`, `RuntimeError`, `SQLAlchemyError`, `TypeError`, `ValueError`) вместо слепого `Exception` в `_safe_exc_message` и в handler `ResponseValidationError`.
- `models/department.py`: в `__repr__` — `except (AttributeError, SQLAlchemyError)` (detached ORM).

Verify: `ruff check core/exception_handlers.py models/department.py` OK.

#### 58. Backend: self_check — flush → return ORM в `update_*`

Защита от регрессии §56: AST-проверка в `self_check/services_update_flush.py`, подключена из `self_check/services.py`.

- Сканирует `async def update_*` (кроме `*_for_response`) в `services/`.
- После `await flush_entity(...)` запрещён `return <параметр_функции>` без mitigation: `refresh_entity`, `db.refresh`, `x = await require_*` / `*_by_id`, либо безопасный `return await require_*` / `create_*` / `build_*_response` / `*Response(...)`.

Verify: `self_check.services_update_flush.collect_errors()` → 0 на текущем дереве.

#### 59. Backend/Frontend: отображение стилей шапки при загрузке ExcelEditor

**Симптом:** при открытии шапки протокола не видно жирный/курсив/размер/шрифт из xlsx — все строки выглядят одинаково; тулбар не отражает формат выбранной ячейки.

**Причины:**
- `extract_header_cell_styles` читал `worksheet.cell` напрямую — для объединённых ячеек стиль терялся (`MergedCell`).
- Жирный/курсив определялись только по `font.bold` / `font.italic` (не по имени шрифта и `b`/`i`).
- Шрифт (`font.name`) не извлекался и не применялся в UI.
- На фронте проверка только `fontWeight === 'bold'` без нормализации `700` и snake_case.

**Исправление:**
- Backend: `resolve_style_cell` в `utils/excel_typing.py`; улучшенный разбор стиля в `template_excel_edit.py` (+ `font_family`); сохранение `fontFamily` при записи в xlsx.
- Schema: `ExcelCellStyle.font_family` / `fontFamily`.
- Frontend: `cellStyleFormat.ts`, расширен `normalizeCellStyles`; в `ExcelEditor` — `font-family` через CSS-переменную, нормализованные bold/italic, подпись «Шрифт: …» в тулбаре при выборе ячейки.

#### 70. Backend: PATCH `/samples/{id}/` — MissingGreenlet на `updated_at`

**Симптом:** после сохранения пробы — 500, `ResponseValidationError` на `updated_at` (`MissingGreenlet`).

**Причина:** `update_sample` после `flush` делал `db.refresh` только для relationships (`attribute_names=[...]`), из‑за чего скалярные колонки (в т.ч. `updated_at` с `onupdate`) протухали.

**Исправление:** паттерн §56 — `return await require_sample_by_id(db, sample.id)` вместо частичного `db.refresh`. Self-check: запрет `db.refresh(..., attribute_names=...)` в `services_update_flush.py` (§70).

#### 71. Backend: порядок API-роутов + self-check

**Симптом:** запрос к литеральному пути (`/samples/registration-numbers/`) → 422, если раньше объявлен `/samples/{sample_id:int}/`.

**Причина:** FastAPI сопоставляет роуты в порядке регистрации; path-параметр перехватывает литеральный сегмент.

**Исправление:** `get_registration_numbers` перенесён выше `{sample_id:int}` в `api/sample.py`; `get_excel_styles_endpoint` — выше `{template_id:int}` в `api/protocol_template.py`. Self-check: `self_check/api_route_order.py`. Rules: `backend.api.router_order`, `self_check` в `03-backend.mdc` / `02-global-principles.mdc`.

#### 72. Backend: расширение self-check (api + SQLAlchemy)

**Добавлено:**

- `api_route_duplicates.py` — дубли method+path в одном `api/*.py`
- `api_path_params.py` — `{*_id}` без `:int` (allowlist `{hsnils}`)
- `api_background_tasks.py` — BackgroundTasks + request-scoped AsyncSession в handler
- `api.py` — запрет `db.refresh()` в api
- `sync_sqlalchemy.py` — `create_engine` / `sessionmaker` / `Session` в core, models, repositories
- `api_routes_ast.py` — общий AST для роут-проверок (route_order, duplicates, path_params)

**Verify:** новые модули — 0 нарушений в текущем коде; `python check.py` (Ruff → basedpyright → import-linter → self_check).

#### 73. Backend: Ruff SIM102 в `api_routes_ast.py`

**Симптом:** `check.py` падает на Ruff — вложенные `if` в `extract_path_from_decorator`.

**Исправление:** объединены условия извлечения `path` из keyword-аргумента декоратора в один `if`.

#### 80. Backend: POST /calculations/ — MissingGreenlet при CalculationResponse

**Симптом:** 500 при создании расчёта; `sample` и `research_method` — `MissingGreenlet` в `CalculationResponse.model_validate`.

**Причина:** `create_calculation` возвращал ORM после `flush` без eager load связей; `build_calculation_response` читает `sample` и `research_method` при сериализации.

**Исправление:** после `add_calculation` — `require_calculation_by_id` (как в `update_calculation`); repository уже грузит связи через `selectinload`.

#### 81. Self-check: re-fetch после create_* + дедуп browser console в Vite

**Self-check:** `services_update_flush` расширен на `create_*` (не `*_for_response`); flush = `flush_entity`, `add_and_flush`, `*_repo.add_*`; ловит `return await repo.add_*` и `return entity` без `require_*_by_id`. Исправлены `create_branch`, `create_sample`, `create_protocol`.

#### 82. Backend: CalculationResponse — MissingGreenlet на sample.branch / sampling_location

**Симптом:** POST /calculations/ — 500; `sample.branch`, `sample.sampling_location` — MissingGreenlet.

**Причина:** `get_calculation_by_id` грузил у sample только `laboratory` и `department`; `SampleResponse` читает ещё `branch` и `sampling_location` для `*_name`.

**Исправление:** `_calculation_response_load_options()` в `repositories/calculation.py` — полный набор связей sample; используется во всех list/get расчётов для ответа API.

#### 83. Self-check + rules: nested SampleResponse eager load

**Rules:** `nested_response_load` в `03-backend` — вложенный child *Response требует полного набора selectinload связей child, как в `get_<child>_by_id`.

**Self-check:** `repositories_nested_sample_load` — при `selectinload(*.sample).selectinload(Sample.*)` если начат набор SampleResponse-связей, обязательны все четыре: `laboratory`, `department`, `branch`, `sampling_location`.

#### §94. Мониторинг — сжатие стека ошибок (31.08.2026)

`utils/monitoring_error_format.py` — `compact_stack_trace` / `compact_error_message` (до 4 фреймов приложения, лимит стека 1200).

#### §95. Мониторинг — добивка UI и удаление моков (31.08.2026)

- Удалены dev-моки: `services/monitoring_mock_seed.py`, эндпоинты `POST/DELETE /api/monitoring/dev/mock-errors/`, `delete_monitoring_errors_by_fingerprint_prefix` в repository.

#### §102. Мониторинг — короткий браузер в деталях (31.08.2026)

`utils/format_short_browser.py`; в `MonitoringErrorResponse` — `browser` (`@computed_field` из `user_agent`).

#### §103. Мониторинг — период «за всё время» и путь онлайн (31.08.2026)

Период `all` в сводке и журнале ошибок.

#### §104. Мониторинг — период с бэкенда (31.08.2026)

`MONITORING_PERIOD_OPTIONS`, `DEFAULT_MONITORING_PERIOD` в `utils/monitoring_period.py`; фильтр списка ошибок по `period` на бэкенде.

#### §105. Мониторинг — без сортировки по умолчанию (31.08.2026)

Без выбора пользователя — порядок `last_seen_at desc` на бэкенде.

#### §106. Мониторинг — сжатие стека только на бэкенде (31.08.2026)

**Сделано:** удалён `compactErrorTrace.ts`; `clientErrorReporter` отправляет сырой `message`/`stack_trace`; сжатие в `prepare_error_payload` при записи.

#### §107. Мониторинг — подписи и фильтры из API (31.08.2026)

`utils/monitoring_labels.py`; в overview — `severity_options`, `source_options`, `resolved_options`, `health_options`, `presence_options`.

#### §108. Мониторинг — фильтры колонок и модалка очистки (31.08.2026)

Фильтры по повторам, версии и последнему появлению на бэкенде.

#### §110. Research methods — пустой unit в ответе и prefill всех карточек (31.08.2026)

В `ResearchMethodResponse` поле `unit` — обычная `str`.

#### §111. Мониторинг — добивка аудита (31.08.2026)

heartbeat → 403 без доступа; `MonitoringMessageResponse` из service; `require_monitoring_error_by_id`; enum через `make_enum_validator`; удалён `/resolve/`; `MonitoringErrorListFiltersDep`.

#### §112. Мониторинг — границы слоёв для периода (31.08.2026)

**Сделано:** константы периода (`DEFAULT_MONITORING_PERIOD`, `MONITORING_PERIOD_QUERY_PATTERN`, `MonitoringPeriodValue`) — канон в `utils/monitoring_period.py`; `core/deps.py` импортирует их из `utils`, не из `schemas` (import-linter: `core` → `schemas` запрещён); для overview — `MonitoringOverviewPeriodDep` вместо `Query(...)` в `api/monitoring.py`; `api` не импортирует `utils`. Проверки: `check.py` — ruff, basedpyright, import-linter, self-check OK.

#### §113. Мониторинг — категория присутствия без fallback (31.08.2026)

**Сделано:** убран fallback `engineer` для пользователя без `laborant`/`engineer` и без `is_admin`; `resolve_presence_category` → `DomainValidationError`. В `resolve_user_permissions` не-админ с пустым `role_types` → `access_granted: false`.

#### §114. database_health — переименование utils-модуля (31.08.2026)

**Сделано:** `utils/health_check.py` → `utils/database_health.py`; импорты в `services/health.py` и `services/monitoring.py`.

### Frontend

#### 36. Хвосты после сверки REFACTOR с кодом

**Frontend:**
- Удалены мёртвые `useProtocolTemplates` / `useReportTemplates` (потребители уже на `useAvailable*` с §28); public API Protocol/Report очищен.
- `expandMenu` в `useSideBar` вызывает `onMinimizeChange(false)` — `sidebarCollapsed` в Outlet (§16) не рассинхронизируется.
- Удалена пустая папка `widgets/CalculationsWorkspace/lib/` после переноса `parseSearchParamInt` (§24).

Verify: `python check.py` OK; `npm run lint` OK.

#### 37. Frontend: PermissionsProvider → `app` (wiring)

Добивка по FSD / `app_auth`: обёртка Provider — слой `app`; Context, хуки и матрица прав остаются у владельца домена.

- `PermissionsProvider` перенесён в `app/auth/ui/PermissionsProvider` (wiring дерева после `/me`).
- `PermissionsContext`, `PermissionsContextValue`, `useCan` / `usePermissionsContext` / `useScopeAccess` и конфиг прав — в `entities/Role` (без переноса матрицы в `app`).
- Из public API `Role` снят `PermissionsProvider`; наружу добавлен `PermissionsContext` для обёртки в `app`.
- `AppLayout` импортирует Provider из `../auth`.

Verify: `npm run lint` OK.

#### 38. Frontend: только light-тема + шум Vite build

- `app/index.css`: убраны тёмный дефолт Vite (`#242424` / `#1a1a1a`), `color-scheme: light dark` и `@media (prefers-color-scheme: light)`. Зафиксированы `color-scheme: light`, светлый фон и текст; глобальные стили `button` из шаблона Vite удалены (кнопки — antd / shared).
- `vite.config.ts`: `rollupOptions.onwarn` глушит шум зависимостей — `EVAL` из `node_modules` (lottie-web / vm-browserify) и `MISSING_EXPORT` для `process.version` (`@peculiar/webcrypto` + shim `vite-plugin-node-polyfills`).

#### 41. Frontend: empty-state подразделений в LaboratoryManagement

На экране лаборатории без подразделений карточка «Добавить первое подразделение» (`AddDepartmentCard` с `width: 100%`) растягивалась на всю ширину контейнера и выглядела крупнее кнопки «Добавить метод расчёта».

В `LaboratoryManagement.css` для `.empty-departments-actions` обе кнопки выровнены: `flex: 1 1 220px`, `max-width: 280px`, `min-height: 140px`; у карточки подразделения в empty-state — `width: auto`.

Добавление лаборатории — только на списке лабораторий (`viewMode === 'laboratories'`, карточка «Добавить лабораторию»), не на экране ИЛНИМ.

#### 42. Frontend: цикл рендеров AdminWorkspace / CalculationPanel

Симптом: `Maximum update depth exceeded` на `useAdminWorkspace.ts` (`setDataLoadedCallback`).

Причина: `useCalculationPanel` в `useEffect` вызывал `onLoadRegistrationData(callback)` → parent делал `setDataLoadedCallback` → ререндер → новая identity handler → снова effect.

Исправление:
- `useAdminWorkspace`: колбэк загрузки по рег. номеру хранится в `ref`, регистрация без `setState`.
- `useCalculationPanel`: регистрация один раз на `form` (актуальный handler через `ref`).
- `researchMethodsQueryStore`: setters не пишут в store, если `pageSize` / sorting / lab / dept не изменились (меньше лишних ререндеров подписчиков).

#### 43. Frontend: растягивание list-панелей (Samples и др.)

Симптом: на «Поступления проб» таблица/empty-state визуально растянуты на всю высоту с лишней пустотой.

Причина: `.samples-page-container` (и аналоги) задавали `height: calc(100vh - 195px)` **без** `box-sizing: border-box`, а padding `80px` сверху для absolute NavigationBar добавлялся снаружи → контейнер выше области `.layout .content`. Плюс Vite-стиль `body { display: flex; place-items: center }` мешал нормальному full-page layout.

Исправление:
- `Layout.css` `.content` — `display: flex; flex-direction: column` (дети заполняют высоту через flex).
- Samples / Protocols / Equipment / Roles / TestObjects / NdNorms: вместо `calc(100vh - …)` — `flex: 1 1 0`, `min-height: 0`, `box-sizing: border-box`; табличная зона — `flex: 1 1 0` + `overflow: hidden`.
- `index.css`: убран `place-items: center` у `body`; `#root` на всю ширину/высоту.

#### 44. Frontend: antd message/Select warnings + сайдбар без скруглений

- `notify`: вместо static `message.*` — instance из `App.useApp()` через `NotifyProvider` внутри `<AntApp>` (документация antd: static message не видит theme/context). Конфиг тостов — prop `message` у `AntApp`; убран `message.config` / `destroy` из `App.tsx`.
- Select: `onDropdownVisibleChange` → `onOpenChange` в filter-row Samples/Equipment/NdNorm; в `shared/ui/FormItems/Select` — алиас на `onOpenChange`.
- SideBar: у пунктов меню (`button.menu-item` / `menu-item-active`) явно `border-radius: 0` — после a11y-перевода на `<button>` появлялось скругление UA/темы.

#### 45. Frontend: горизонтальное переполнение list-панелей

Симптом: белая карточка Layout и таблица уезжают вправо, колонка «Дата создания» обрезается без нормального скролла.

Причина: в flex-ряду `content-wrapper` (SideBar + Layout) у `.layout-wrapper` не было `min-width: 0` (дефолт `min-width: auto`). Широкая таблица (`width: max-content`) раздувала колонку контента шире окна; `overflow: hidden` обрезал правый край.

Исправление:
- `layout-wrapper`: `min-width: 0`, `overflow: hidden`; сайдбар `flex-shrink: 0`.
- Samples (и соседние list-panels): цепочка `min-width: 0` / `max-width: 100%` / `overflow: hidden`.
- `SamplesTable.css`: убран `width: max-content` (как в HEAD) — таблица `min-width: 100%` + горизонтальный скролл в wrapper.

#### 46. Frontend: скролл модалки без отступа справа

Симптом: в модалках (например «Добавление пробы») полоса прокрутки с зазором от правого края.

Причина: `overflow-y: auto` был на `.body-content`, а padding `20px` — на родителе `.body`, поэтому скролл рисовался внутри отступа.

Исправление в `Modal.css`: padding у `.body` снят; у `.body-content` — `padding: 20px 20px 10px` (скролл у края); футер `.body-buttons` без отрицательных margin, `width: 100%` + свой padding.

#### 47. Frontend: лишний горизонтальный скролл таблиц

Симптом: у Протоколов (и других таблиц) горизонтальный скролл при пустой таблице / когда колонки влезают.

Причина: в CSS таблиц при рефакторинге добавили `width: max-content` (в HEAD было только `min-width: 100%`) — таблица становилась шире контейнера на сумму `size` колонок.

Исправление: убран `width: max-content` у Protocols / Equipment / NdNorm / Roles / TestObject / SelectionCondition / MassFractionOilRefraction / Calculations (Samples уже в §45).

#### 48. Frontend: чекбокс съехал / нет галочки

Симптом: в формах (типы проб и др.) чекбокс над текстом, галочка не видна.

Причина: CSS вида `.research-method-form-fields label { display: block }` попадал на корень antd Checkbox (`label.ant-checkbox-wrapper`) и ломал inline-flex раскладку.

Исправление: селекторы label в FormFields → `label:not(.ant-checkbox-wrapper)` (ResearchMethod, Protocol, Equipment, Sample, Role, TestObject, NdNorm, SelectionConditions, CreateResearchMethodModal).

#### 49. Frontend: отступы модалки «Добавление метода исследования»

- Только для этой модалки (`:has(.create-research-method-modal)`): у `.body-content` `padding-top: 0`, `padding-bottom: 24px` (остальные модалки без изменений).
- Между полями: у `.create-research-method-form-group` — `margin-bottom: 12px` (формула / значение повторяемости и т.п.).
- Между «Наименование НД» и «Условия повторяемости»: в этой модалке у `.research-method-form-group:last-child` сохранён нижний отступ 16px (раньше `:last-child { margin-bottom: 0 }` схлопывал зазор).

#### 50. Frontend: типы проб без кнопок + отступы промежуточных переменных

- `ResearchMethodFormFields`: «Выбрать все» / «Очистить» и список чекбоксов только если `sampleTypeOptions.length > 0` (при пустом справочнике — только подсказка).
- Отступы в карточке переменной: единый шаг `gap: 12px` у `.field-group` / `.field-stack` / `.range-item`; у вложенных полей, чекбоксов и блока «Округление» сняты складывающиеся `margin` (раньше `gap` + `margin-bottom` давали разный зазор между «Формула»→«Описание» и «Описание»→«Единица»).

#### 51. Frontend: ExcelEditor шаблона — стили, двойная рамка, Select

- Жирный/курсив/кегль сбрасывались: `useEffect` в `ExcelEditor` зависел от `onDataChange`, нестабильный колбэк родителя откатывал `cellStyles` к данным запроса. Синхронизация только от `excelData` (колбэк через ref).
- Двойное выделение ячейки: убраны дублирующие `outline` у `td.selected` и у textarea; остаётся `border` на выбранной ячейке.
- В редакторе `font-synthesis: weight style` — глобальный `:root { font-synthesis: none }` не давал синтезировать жирный/курсив для HeliosCondC.
- `dropdownRender` → `popupRender` в `EditProtocolTemplateModal` и `EditReportTemplateModal` (antd Select).

#### 52. Frontend: цвета кнопок (primary / danger / залипающий focus)

- Primary solid («Добавить» и т.п.): тёмный текст на синем из‑за глобального `color` на `:root`/`body` и CSS-in-JS antd. В `Button.css` — белый текст/иконки для primary solid; в теме — `colorTextLightSolid` / `primaryColor` / `solidTextColor`. Точечные `!important` у «Сохранить» в модалках условий/МД удалены как дубли.
- Danger text («Удалить»): бренд `#ff4d07` для text/link в `Button.css`.
- «Редактировать» с голубым фоном после клика: убран `:focus { background }` у action-кнопок таблиц (оставлен только `:hover`).

#### 53. Frontend: один скролл в «Редактирование шаблона»

- Убраны вложенные скроллы: у `.excel-editor-table-container` сняты `max-height`/`overflow: auto`, у `.editor-content` и `.edit-protocol-template-modal-content` — свой `overflow-y`. Скролл только у `.body-content` модалки.

#### 54. Frontend: «Редактировать» снова синяя в модалках

- В `Modal.css` у правила для `p/span/div` внутри `.body-content` убран `color: #000` — он перебивал цвет текста и иконок у action-кнопок (в т.ч. `#1890ff` у «Редактировать»).

#### 60. Frontend: breadcrumb «ИЛНиНМ» → список подразделений

**Симптом:** из админки подразделения клик по лаборатории в цепочке (`ИЛНиНМ`) открывал общий список лабораторий, а не экран подразделений этой лаборатории.

**Причина:** гонка в `useLaboratoryManagement` — эффект синхронизации state→URL сбрасывал `?viewMode=departments&laboratoryId=…` до восстановления состояния из query.

**Исправление:** восстановление из URL в `useLayoutEffect` + блокировка sync до `isUrlStateReadyRef`; в breadcrumb `useAdminWorkspace` — `labId` вместо строки из params. Добивка: гидратация при каждом изменении query (`lastHydratedUrlKeyRef`), проверка `canAccessLaboratory` вместо `canAccessFeature` без department.

#### 61. Frontend: блок «Тип пробы» и кнопки «+ Добавить …» в форме метода

**Симптом:** в карточке метода исследования поле «Тип пробы» выглядело разорванным (лейбл → кнопки → чекбоксы); у «Выбрать все» / «Очистить» — лишний focus-outline при клике; у «+ Добавить промежуточную переменную» / «+ Добавить условие повторяемости» — двойная пунктирная рамка.

**Причины:**
- Лейбл через `FormField`, действия и чекбоксы — отдельными блоками под ним.
- `empty-fields-container` и `.add-field-btn` оба с `border: dashed`.

**Исправление:**
- `ResearchMethodFormFields`: заголовок с лейблом и действиями в одной строке; чекбоксы в панели с рамкой (строка + перенос); `:focus-visible` вместо браузерного outline на текстовых кнопках.
- Порядок полей: название → единица/метод/НД → тип пробы; секции `name` | `catalog` | `sample_type`; в `ResearchMethodSingleForm` один блок вверху формы (каталог убран из середины).
- `CreateResearchMethodModal.css`: рамка только у `.add-field-btn`, у `empty-fields-container` убрана; `:focus` / `:focus-visible` на add-кнопках; `AddFieldButton` с `PlusOutlined` вместо текстового «+».
- `shared/ui/Checkbox`: `align-items: center` на wrapper — подпись по центру относительно квадрата (HeliosCondC / antd baseline).

#### 62. Frontend: синее выделение фильтров таблиц

**Симптом:** при фокусе в поле «Поиск…» (и других фильтрах строки таблицы) рамка и тень были чёрными вместо синего primary.

**Причина:** в `TableFilterTheme` заданы `colorPrimary`, `activeBorderColor`, `hoverBorderColor` и `controlOutline` на `#282828` / чёрный rgba.

**Исправление:** цвета фокуса/hover в `shared/ui/TableFilter/TableFilterTheme.tsx` приведены к `#1677ff` (как в `App.tsx`).

#### 63. Frontend: ширина и перенос в popup Select фильтров таблиц

**Симптом:** выпадающий список фильтра обрезал длинные подписи по ширине узкого столбца.

**Исправление:** `TableFilterCell` + `useTableFilterSelectPopup` — min-width = ширина столбца, max-width = столбец + соседний справа (для последнего — + слева); `popupMatchSelectWidth={false}`; текст опций — перенос, не более 2 строк (`line-clamp: 2`). Подключено во всех `*TableFilterRow` и `RolesTable`.

#### 64. Frontend: лишний скролл в коротких Select формы метода

**Симптом:** в «Погрешность измерения» (3 пункта) выпадающий список показывал скролл, хотя все опции помещались.

**Причина:** `listHeight={100}` меньше фактической высоты пунктов при виртуальном списке antd.

**Исправление:** для коротких списков в `CreateResearchMethodModal` — `virtual={false}` без `listHeight` (погрешность, округление, повторяемость, вложенное округление промежуточных).

#### 65. Frontend: селект варианта метода в панели расчёта

**Симптом:** под заголовком группы («Вязкость кинематическая») Select «При 20 °C» растягивался на всю ширину панели.

**Причина:** `FormItems/Select` задаёт `width: 100%` inline; классы `admin-page-select` / `calculations-page-select` с `470px` не перебивали.

**Исправление:** обёртка `calculation-panel-group-selector` в `CalculationPanel`; у Select в workspace — `style={{ width: 'auto', minWidth: 220 }}`, `max-width: 470px` на обёртке.

#### 66. Frontend: скачок селекта варианта метода в AdminWorkspace

**Симптом:** при переключении метода в группе (селект «Конденсат» / «Нефть» и т.п.) значение осциллировало между id 1 и 2.

**Причина:** гонка двусторонней синхронизации `selectedMethodId` ↔ `?methodId=` в `useAdminWorkspaceMethodSelection` — эффект гидратации из URL перезапускался при каждой смене state и при refetch списка методов, откатывая выбор к старому query.

**Исправление:** разделены направления sync — URL → state только при изменении `searchParams` (ref `lastHydratedUrlMethodId`), state → URL только при ненулевом `selectedMethodId`; автовыбор вынесен в отдельный эффект.

#### 67. Frontend: 422 при загрузке справочников в модалках (page_size=1000)

**Симптом:** при открытии модалки сохранения расчёта — `422` на `/api/samples/` и `/api/equipment/` (`page_size` должен быть ≤ 100).

**Причина:** lookup-хуки запрашивали `page_size=1000`, хотя API допускает пагинацию только до 100; для полного списка в scope нужно не передавать `page`/`page_size` (бэкенд отдаёт все записи).

**Исправление:** в `useEquipmentForCalculation`, `useEquipmentForScope`, `useSamplesForCalculation`, `useSamplesForProtocol` — запрос без пагинации (`undefined` вместо `1, 1000`).

#### 68. Frontend: UserPicker — сброс курсора и deprecation DatePicker

**Симптом:** при вводе первого символа в пикере сотрудника курсор сбрасывался; в консоли — warning antd Input (динамический suffix) и deprecation `popupClassName` у DatePicker.

**Причина:** `allowClear={… && Boolean(searchText)}` переключал suffix при появлении текста; в форме пробы `DatePicker` использовал устаревший `popupClassName`.

**Исправление:** стабильный `allowClear` в `UserPicker` и `RegistrationNumberPicker`; в `SampleFormFields` — `classNames={{ popup: { root: 'custom-date-picker-popup' } }}`.

#### 69. Frontend: отступы и типографика условий отбора

**Симптом:** в карточке условия («Давление» и т.п.) большой пустой отступ снизу; текст мелкий (12px).

**Причина:** grid растягивал карточки по высоте соседней колонки (`align-items: stretch`); общий селектор label давал лишний `margin-bottom`.

**Исправление:** `align-items: start` на `.conditions-grid`, уменьшен padding карточки, label/единица/input — 14px, селекторы label разделены для заголовка блока и поля; `.unit` — `align-items: stretch` в строке с инпутом, flex-центрирование текста, border-radius как у поля.

#### 74. Frontend: CalculationsWorkspace — сломан layout SplitPanel

**Симптом:** на странице расчётов левая панель методов и форма наезжают друг на друга; в AdminWorkspace всё ок.

**Причина:** обёртка `.calculations-page-body` + CSS `.calculations-page-split` сбрасывали `margin-top` и `height` у `SplitPanel` (нужны под абсолютный `NavigationBar`); `.calculations-page-nav { position: relative }` конфликтовал с Layout.

**Исправление:** разметка как в AdminWorkspace — `NavigationBar` + `SplitPanel` прямые потомки `content`; удалены лишние обёртка и переопределения SplitPanel.

#### 75. Frontend: FillCalculationsModal — лоадер вне модалки

**Симптом:** при открытии «Расчёты» с поступления проб спиннер появляется внизу страницы, а не в модалке.

**Причина:** `createLazyFeature` рендерил `FeatureFallback` в потоке `Layout` (без оболочки Modal); `LoadingCard` внутри модалки позиционируется по `.layout-wrapper .content`, а не по телу модалки.

**Исправление:** lazy-обёртка с `Modal` + `Spin` в fallback; загрузка данных — через `CalculationsTable` с `loading` (без `LoadingCard`).

#### 76. Frontend: CalculationsWorkspace — бесконечный спиннер в списке методов + antd Select

**Симптом:** слева «Методы исследования» крутится бесконечно, хотя форма справа уже есть; в консоли `[antd: Select] popupClassName is deprecated`.

**Причина:** `CalculationsMethodsPanel` получал общий `isLoading`, куда входила загрузка деталей выбранного метода; `popupClassName` в `EquipmentDefaultModal`.

**Исправление:** отдельный `isLoadingMethodsList` (только список available + bootstrap); `EquipmentDefaultModal` — `classNames={{ popup: { root: '...' } }}`.

#### 77. Frontend: warn/error из браузера в терминал Vite (dev)

**Запрос:** deprecation и runtime warning из DevTools видны не всегда — нужен вывод в терминал `npm start`.

**Решение:** dev-плагин `vite-plugins/consoleForwardPlugin.ts` — перехват `console.warn` / `console.error`, `window.error`, `unhandledrejection` → HMR → `[browser:warn]` / `[browser:error]` в терминале. Только `vite serve`, в production не подключается. (В Vite 8+ можно заменить на `server.forwardConsole`.)

#### 78. Frontend: FillCalculationsModal — лоадер не по центру

**Симптом:** спиннер в модалке «Расчёты для пробы» прижат к верху.

**Причина:** `.fill-calculations-modal-content > div:last-child` давал `flex: 1` обёртке antd `Spin`; в `CalculationsTable` (modal) не было центрирования при `loading`.

**Исправление:** селектор только на `.calculations-table-container`; класс `calculations-table-container--loading` с `align-items` / `justify-content: center`; для fallback — `flex: 0 0 auto` у единственного ребёнка `--loading`.

#### 79. Frontend: иконка «Рассчитать» не по центру кнопки

**Симптом:** `CalculatorIcon` визуально выше текста «Рассчитать».

**Причина:** кастомная иконка в слоте `.ant-btn-icon` без выравнивания flex/`line-height: 0` (в отличие от `.anticon`).

**Исправление:** `CalculationPanel.css` — `align-items: center` на кнопке и `.ant-btn-icon`, `display: block` у svg.

#### 81. Self-check: re-fetch после create_* + дедуп browser console в Vite

**Frontend:** `consoleForwardPlugin` — в терминал Vite печатается каждый уникальный warn/error один раз за сессию dev-сервера (без повторов при HMR/рендерах).

#### 84. Frontend: места отбора проб, фильтры таблиц (чекбокс), dev-warnings

**Места отбора проб — первый филиал по умолчанию:** при непустом `branchesList` и отсутствии валидного `branchId` в URL автоматически выбирается `branchesList[0]`; валидный `branchId` из URL сохраняет приоритет. `useSamplingLocationsPanelSelection.ts` — упрощённая логика без `shouldAutoSelectRef`.

**Фильтры таблиц — чекбокс и текст в одну строку:** в `TableFilter.css` для `.table-filter-select-option` / `.select-option-row` — `display: flex`, `align-items: center`, `flex-shrink: 0` у чекбокса (до §85 — inline Select; см. ниже).

**`[antd: Spin] tip only work in nest...`:** в `NdNormFormFields` и `EquipmentFormFields` — nest-паттерн (`spinning` + дочерний placeholder с min-height).

**`There may be circular references` (antd Form):** ложное предупреждение `rc-field-form@2.7.x`; в `frontend/package.json` — `overrides`: `rc-field-form` → `@rc-component/form@1.8.6`. Дополнительно: `useUrlSync` — сравнение фильтров через `areFiltersEqual` без `JSON.stringify`; `consoleForwardPlugin` — сериализация с `WeakSet` против циклических ссылок в аргументах warn/error.

#### 85. Frontend: MultiSelectColumnFilter (Ок / Отмена) в фильтрах таблиц

**Запрос:** как в SmartCard — мультиселект фильтра колонки с черновиком и кнопками **Ок** / **Отмена** внизу dropdown.

**Решение:** порт `shared/ui/MultiSelectColumnFilter/` из SmartCard (`filterSelectLayout`, чекбоксы в опциях, `popupRender` с footer). Хелпер `tableFilterMultiSelectProps` — связка с `TableFilterCell` / `useTableFilterSelectPopup` (§63).

**Подключено:** `SamplesTableFilterRow` (тип пробы, объект испытаний), `EquipmentTableFilterRow` (тип), `NdNormsTableFilterRow` (объект испытаний). Значение — из `header.column.getFilterValue()`; применение — через существующий `applyFiltersWithNewValue`.

**Удалено:** `useDeferredMultiSelectFilter` (черновик теперь внутри `MultiSelectColumnFilter`); проп `initialColumnFilters` у filter-row снят (источник — state таблицы).

**Поведение:** черновик до **Ок**; **Отмена** откатывает; закрытие dropdown без кнопок — применяет черновик (как SmartCard); `allowClear` — сразу сброс и apply.

#### 86. Frontend: лишний горизонтальный скролл после MultiSelectColumnFilter

**Симптом:** у Пробы / Протоколы / Оборудование и др. появился горизонтальный скролл при влезающих колонках; у НД — допустим.

**Причина:** `MultiSelectColumnFilter` с `getFilterSelectLayout` задавал ширину селекта до «столбец + соседний» (как SmartCard с `overflow: visible` на filter-cell); в Laborant ячейка `overflow: hidden`, таблица раздувалась шире контейнера.

**Исправление:**
- в контексте `tableFilterMultiSelectProps` (`selectPopup` задан) — селект всегда `width: 100%`; расширение только у popup (`useTableFilterSelectPopup`, §63);
- `getFilterSelectLayout` убран из filter-row;
- `overflow-x: hidden` у `*-table-wrapper` всех list-таблиц, **кроме** `nd-norms-table-wrapper` (`overflow-x: auto`).

#### 87. Frontend: селект «N строк» в TablePagination уехал вправо

**Симптом:** выбор размера страницы прижат к правому краю / обрезан.

**Причина:** `FormItems/Select` задаёт inline `width: 100%`; CSS `.table-pagination-page-size-select { width: 100px }` не перебивает inline — селект растягивался на всю правую часть футера.

**Исправление:** `TablePagination` — `style={{ width: 100 }}` на Select; у `.table-pagination` — `min-width: 0`.

#### 88. Frontend: шрифт и цвета Select в таблице vs «Поиск»

**Симптом:** в фильтрах таблицы и в «N строк» другой шрифт/размер; выделение опции в page-size — тёмно-серое, не как у фильтров.

**Причина:** `PAGE_SIZE_SELECT_THEME` с `colorPrimary: #282828`; `MultiSelectColumnFilter` без `form-item-control`; тема фильтров без `fontFamily` / `optionSelectedBg`.

**Исправление:** общий `TABLE_CONTROL_THEME` (`tableControlTheme.ts`) для `TableFilterTheme` и page-size Select; `form-item-control` на `MultiSelectColumnFilter`.

#### 89. Frontend: цвет и высота Select в таблице vs модалки

**Симптом:** в фильтрах таблицы селект темнее/выше, чем в модалках; после §88 стал ещё выше.

**Причина:** `TABLE_CONTROL_THEME` отличался от App (`colorBorder #babfc7`, `fontSize 13`, кастомные option-цвета); у multi-select в фильтре `align-items: flex-start` и `padding-block` раздували пустой селект.

**Исправление:** `TABLE_CONTROL_THEME` — те же токены, что у модалок (`#d9d9d9`, `borderRadius 8`, `fontSize 14`, `controlHeight 32`); пустой multi-select — одна строка 32px, с тегами — прежний перенос до 58px.

#### 90. Frontend: placeholder селекта фильтра в две строки

**Симптом:** «Выберите типы» в фильтре таблицы переносится на две строки; у «Поиск…» — одна.

**Причина:** у `mode="multiple"` placeholder внутри `.ant-select-selection-overflow` с `flex-wrap: wrap` в узкой колонке.

**Исправление:** для пустого multi-select — `flex-wrap: nowrap` на overflow; у placeholder — `white-space: nowrap` + ellipsis; у single `table-filter-select` — то же для item/placeholder.

#### 91. Frontend: двойной лоадер при переходе между страницами

**Симптом:** при навигации сначала спиннер на весь outlet (без карточки Layout), затем `LoadingCard` внутри страницы.

**Причина:** `RouteFallback` с `min-height: 100vh` рендерился вне оболочки Layout; `Suspense` был на каждой lazy-странице отдельно.

**Исправление:** единый `Suspense` в `AppLayout` вокруг `Outlet`; `RouteFallback` — `Layout` + `LoadingCard` (`minDuration={0}`); предзагрузка чанка по `mouseenter` в сайдбаре (`preloadPageByPath` из `app`, колбэк `onPreloadPath` в `SideBar`).

#### 92. Frontend: `tsc -b` — consoleForwardPlugin и хвосты после §91

**Симптом:** ошибка TS в `vite-plugins/consoleForwardPlugin.ts`; `tsc -b` падал также на `SideBar`, `preloadPages`, `useSamplingLocationsPanelSelection`.

**Причина:** в Vite 7 `configureServer` может быть object-hook, `Parameters<Plugin['configureServer']>` невалиден; дублирующийся `onMouseEnter` в `SideBar`; `noUncheckedIndexedAccess` на `split('?')[0]` и `branchesList[0]`; `vite-plugins` не были в `tsconfig.node.json`.

**Исправление:** тип `ViteDevServer` в `logUnique`; `vite-plugins/**/*.ts` в `include` `tsconfig.node.json`; один `onMouseEnter` (иконка + preload); guard на `branchesList[0]`; деструктуризация pathname в `preloadPageByPath`.

#### §94. Мониторинг — сжатие стека ошибок (31.08.2026)

`entities/Monitoring/lib/compactErrorTrace.ts` — `compactClientErrorPayload` в `clientErrorReporter`.

#### §95. Мониторинг — добивка UI и удаление моков (31.08.2026)

- Таблица ошибок: ужаты колонки, ellipsis в «Описание», короткие placeholder фильтров, `overflow-x: auto`, `min-width: 760px`, кнопки `size="small"`.
- Модалка деталей — `shared/ui/Modal`; скролл страницы — внутри таблицы, не под NavigationBar.
- Смена статуса: `notify.success` / `notify.error` в `useMonitoringMutations`; обновление модалки только в `onSuccess` мутации.

#### §96. Мониторинг — двухколоночный layout (31.08.2026)

**Сделано:** `MonitoringPanel` — grid: левая панель (`monitoring-page-sidebar`) со сводкой и онлайн, правая (`monitoring-page-main`) с журналом ошибок; на `<992px` — одна колонка, таблица ниже.

#### §97. Мониторинг — панель с границей и таблица без горизонтального скролла (31.08.2026)

**Сделано:** обёртка `monitoring-page-panel` (border, единый фон); скролл левой колонки внутри панели у разделителя. `MonitoringErrorsTable` — prop `embedded`: рамка контейнера таблицы, `colgroup` с процентами, без resize колонок; фиксированные ширины колонок в embedded.

#### §98. Мониторинг — компактная модалка деталей (31.08.2026)

**Сделано:** `modalWidth="550"`, сетка метаданных 2×N, сообщение и стек в отдельных блоках; бейджи уровня/статуса как в таблице.

#### §102. Мониторинг — короткий браузер в деталях (31.08.2026)

В модалке деталей показывается `browser` из API.

#### §103. Мониторинг — период «за всё время» и путь онлайн (31.08.2026)

`PresenceHeartbeat` внутри Router — heartbeat при смене `pathname`, инвалидация overview.

#### §104. Мониторинг — период с бэкенда (31.08.2026)

В overview — `period_options`, `default_period`; фронт берёт варианты и подписи из API.

#### §105. Мониторинг — без сортировки по умолчанию (31.08.2026)

Убрана начальная сортировка по `occurrence_count` в UI.

#### §107. Мониторинг — подписи и фильтры из API (31.08.2026)

Удалён `labels.ts`; `getMonitoringOptionLabel` для отображения.

#### §108. Мониторинг — фильтры колонок и модалка очистки (31.08.2026)

Колонки таблицы + `MonitoringCleanupConfirmModal` вместо `AntModal.confirm`.

#### §109. «Показать» — prefill второй карточки фракционного состава (31.08.2026)

**Сделано:** в `buildCalculationFormPrefill` ключ полей card2 приведён к `${methodId}_${fieldName}_card_2` (как в `ParallelCard` и `prepareInputData`); раньше использовался суффикс `_2`, из‑за чего «Показать» заполняло только первую карточку.

#### §110. Research methods — пустой unit в ответе и prefill всех карточек (31.08.2026)

В `buildCalculationFormPrefill` — `getCalculationFormFieldName` и обход `input_data.fields` с `card_index` для всех методов.

#### §111. Мониторинг — добивка аудита (31.08.2026)

`monitoringQueryStore`, URL sync, модалки в `features/*`, `monitoringKeys.overviews()`, `AppErrorBoundary` через `shared/ui/ReactErrorBoundary`.

---

## 01.09.2026

Точечные правки мониторинга и SideBar.

### Backend

#### §115. Мониторинг — сортировка по версии (01.09.2026)

- `repositories/monitoring.py` — `app_version` в `sort_mapping` для сортировки журнала ошибок.

### Frontend

#### §115. Мониторинг — запятая в мс и иконки SideBar (01.09.2026)

- Задержка PostgreSQL в сводке — `formatNumberForDisplay` (12,5 мс).
- SideBar: `LineChartAntdIcon` («Градуировочный график»), `BugAntdIcon` («Мониторинг»).
- Колонка «Версия» в таблице ошибок — `enableSorting: true`.

#### §116. Поиск ФИО — инверсия раскладки (01.09.2026)

- `shared/lib/formatting/normalizeFioSearch.ts` — `normalizeFioSearch` / `matchesFioSearch` (пакет `convert-layout`, как в SmartCard).
- `employeesApi.searchByFio` / `searchByFioAndLaboratory` — нормализация на границе API (`bdfy` → `иван`).
- Покрывает все `UserPicker` (пробы, протоколы, расчёты); фильтр колонки «Добавил пробу» в таблице проб — `matchesFioSearch`.

#### §117. Фракционный состав конденсата — объёмные доли (02.09.2026)

- Причина: в § refactor `2121780` поля переименованы «Объемная» → «Объёмная» в фикстуре и расчёте; методики в БД со старыми именами полей перестали отдавать объёмные доли.
- `utils/calculation/fractional_keys.py` — `get_fractional_card_value`, алиасы legacy-ключей, нормализация «Объемная» → «Объёмная» в `normalize_fractional_key`.
- `services/calculation/fractional_composition.py` — чтение объёмных долей через хелпер.
- `services/protocol/generator.py` — `_iter_fractional_condensate_rows` через `normalize_fractional_key`.
- `entities/ResearchMethod/lib/calculation.ts` — `normalizeFractionalKey`; таблица расчётов (`tableUtils`, `calculationsTableColumns`).

#### §118. Мониторинг — DateRangePicker «Последнее» (07.09.2026)

### Backend

- Фильтр журнала: `last_seen` (ILIKE по `to_char`) заменён на `last_seen_at_from` / `last_seen_at_to` через `parse_date_range` + `add_date_range_filter` по `updated_at`.
- Период сводки (`period` → `period_since`) по-прежнему ограничивает нижнюю границу; диапазон колонки накладывается дополнительно.

### Frontend

- Колонка «Последнее»: `RangePicker` + `getDateRangePresets()` (как в пробах/оборудовании).
- URL/store: `last_seen_at_from` / `last_seen_at_to`.
- `getDateRangeFilterValue` вынесен в `shared/lib/formatting` (единый хелпер для таблиц).
- SideBar «Мониторинг»: `PulseIcon` (как `BiPulse` в SmartCard) с анимацией линии вместо `BugAntdIcon`.
- Закрытие/открытие ошибки: `useUpdateMonitoringErrorStatus` инвалидирует `monitoringKeys.errors()` и `monitoringKeys.all` — таблица и сводка обновляются без перезапуска.

#### §119. Мониторинг — from_app в heartbeat и ширина online-chip (07.09.2026)

### Backend

- `HeartbeatCreate.from_app: bool = False`; `record_heartbeat` без `from_app=true` отвечает ok и presence не пишет (как в SmartCard).

### Frontend

- `monitoringApi.sendHeartbeat` всегда дописывает `from_app: true`.
- `.monitoring-online-chip` — `width: 100%`, список `align-items: stretch`.

#### §120. Мониторинг — цвет пути в деталях и Warning через console.error (07.09.2026)

**Сделано:**

- В модалке деталей путь (`path`) — цвет `#5f6770`, как у online-chip path.
- `clientErrorReporter`: сообщения с префиксом `Warning:` из `console.error` пишутся с severity `warning` (React/antd DEV).
- `FEATURES.md` обновлён.

#### §121. Мониторинг — fingerprint без пути страницы (07.09.2026)

**Сделано:**

- `compute_error_fingerprint` больше не учитывает `path`: одинаковая ошибка на разных страницах — одна запись.
- При повторе обновляются `path` (последнее появление) и `summary`.
- `summary` без пути (путь только в деталях).
- То же в SmartCard.
- `FEATURES.md` обновлён.

#### §122. normalizeFioSearch → shared/lib/formatting (07.09.2026)

**Сделано:** `normalizeFioSearch` / `matchesFioSearch` перенесены с корня `shared/lib/` в `shared/lib/formatting/` (как остальные строковые UX-хелперы); импорты через `@/shared/lib/formatting`.

#### §123. Date-range фильтры — односторонние границы (07.09.2026)

**Сделано:**

- `getDateRangeFilterValue` допускает только «с» или только «по» (как URL/API и `add_date_range_filter`).
- `matchesDateRange` вынесен в `shared/lib/formatting`; односторонняя граница реально фильтрует (раньше при одной дате клиентский filterFn пропускал все строки).
- В filter-row RangePicker: `allowEmpty={[true, true]}` (документация Ant Design).
- Удалены дубли `tableUtils.matchesDateRange` у Sample/Protocol; Equipment `dateRangeFilterFn` делегирует в shared.

---

## Не входило / ждёт решения

- Zod, `!important`, `z-index` — пользователь отклонил предложение.
- Массовый `rem` для типографики и полная сетка отступов — пользователь отклонил предложение, используем px.
- «Толстые» модалки в `features` — **решено оставить** по критерию в §12; перенос в `widgets`/`entities` без compose на `pages` не делать. Повторные аудиты, требующие перенос в `widgets`, отклонять со ссылкой на §12.
- `PermissionsProvider` → `app` — закрыто в §37; Context/хуки/матрица прав остаются в `entities/Role`.
- Публичный внешний контракт URL API не менялся намеренно при переименовании файлов роутеров — любые сдвиги path/query только по отдельному запросу.
- Responsive `max-width` → mobile-first `min-width` — вне скоупа (как массовый `rem`/шкала отступов).
- Массовый разнос `@x` в пользу slots/compose на widget — смена архитектуры §10, не добивка. Точечная чистка неиспользуемых экспортов из `@x` — ок (§19).
- `FormulaKeyboard` остаётся в `entities/Calculation` по §10 (критерий §12 формально один потребитель — не переносить без отдельного решения).
- `RegistrationNumberPicker` остаётся в `entities/Calculation` (§22, то же исключение, что у `FormulaKeyboard`).
- `ExcelEditor` остаётся в `entities/Protocol` (§10 / §22; один feature-потребитель — не переносить без отдельного решения).
- Осознанные `.ant-*` (`UserPicker`, `ProtocolFormFields`) и селектор Modal §7 / `App.css` — не трогать.
- Хвост голых `.anticon` вне исключений — закрыт в §18; новые `.anticon` / `.ant-*` в entities/features/widgets не добавлять (только theme, `shared/ui` или явный комментарий «почему CSS»).
- Хвост мёртвого public API сущностей / лишнего в `@x` / `Menu` — закрыт в §19; добивка реэкспортов `*QueryState` / props / helpers — §20; хвост `*Create` / `*Update` / `*ListParams` / DTO — §21.
- Scoped `.button-wrapper` / `.form-item-container` под своим родителем слайса — осознанный паттерн §7 / §16 / §20; не требовать выноса в props без отдельного решения.
- Повторные аудиты с требованием переноса толстых модалок в `widgets` — отклонять по §12 (см. выше).
- Массовый разнос хардкода `#1890ff` / `#262626` / `#8c8c8c` в токены темы — вне скоупа этой добивки (хвост §3, только по отдельному запросу).
- JWT-логирование в keycloak и `export *` в `entities/*/api/index.ts` — закрыты в §23.
- URL-sync workspace: list-panel — только `useUrlSync`; workspace selection — точечный query (§23); не натягивать `useUrlSync` на master-detail workspace.
- `RefractionTablesPanel`: `selectedMethod` / модалка в state — осознанно без query (deep link не требуется); менять только по отдельному запросу.
- `HelpPage` — `<a>` без `href` у «системы поддержки пользователей» (§24): URL поддержки нет; не добавлять пустую ссылку без адреса от заказчика.
- Хвост §8 `CreateAnimatedAntdIcon` / `preserveCursorPosition` / internal lib barrel `CreateResearchMethodModal` — закрыт в §27.
- Report / Protocol `available` — оба `include_deleted=True` на backend; select в `EditReportTemplateModal` / `EditProtocolTemplateModal` фильтрует активные на UI (`!deleted_at`). Не менять без отдельного решения.
- Хвост available-шаблонов / `menu` / `useCallback` — закрыт в §28.
- Хвост §32 простой CRUD / мёртвые paginated template-hooks / `expandMenu` sync / пустой `CalculationsWorkspace/lib` — закрыт в §36; enriched protocol/calculation/role/test_object и sample list не трогать без отдельного решения.
- health остаётся тонким handler в api (§29 / §36); не требовать `services.meta` без бизнеса.
- `@IsAuthenticated` в self_check fail — не включать, пока декораторы закомментированы (intentional_do_not_touch); включать только после решения раскомментировать auth на api.
- `utils` → `core.logger` — исключение self_check / факт кода; полный отрыв utils от core — отдельное решение.
- Single-select фильтры таблиц (например `is_accredited` в Protocols) — без **Ок**/**Отмена**; паттерн §85 только для `mode="multiple"` (как SmartCard).
