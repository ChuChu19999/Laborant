# FEATURES

Журнал новых возможностей приложения.

---

## Мониторинг (admin)

**Дата:** 28.08.2026

### Назначение

Страница «Мониторинг» для администратора: уникальные ошибки backend и frontend, счётчики пользователей онлайн, сводка состояния сервиса и БД.

### Ошибки

- Уровни: **предупреждение**, **ошибка**, **критическая**. Сообщения вида `Warning: …` из `console.error` (React/antd в DEV) пишутся как **предупреждение**, не как ошибка.
- Источники: **бэкенд** (необработанные 500, `ResponseValidationError`) и **фронтенд** (`console.warn/error`, `window.error`, `unhandledrejection`, Error Boundary).
- Дедупликация по fingerprint (SHA-256 сообщения, источника, уровня и верхней строки стека; путь страницы не входит — одна ошибка на разных страницах сливается); при повторе — `occurrence_count++`, без новой строки в БД. Путь в записи — место последнего появления.
- Текст укорочен: сообщение до 500 символов; стек сжимается до ключевых фреймов кода приложения (без `site-packages`, `node_modules`, uvicorn/starlette и т.п.), до 1200 символов; в таблице — `summary` до 280 символов.
- 422 / 404 / 403 и `/api/health/` не записываются.
- Статус ошибки: **открыта** / **закрыта** (`resolved_at`). Администратор может закрыть или снова открыть ошибку из таблицы и из модалки «Детали».
- При закрытии — необязательный **комментарий** (`resolve_comment`), в аудите — **кто закрыл** (`resolved_by_name`). Модалка «Примечание при закрытии/открытии» при действии из таблицы и из деталей.
- При открытии снова — необязательное примечание; дописка в `resolve_comment` («Открыто снова: …»), данные закрытия сохраняются.
- При повторе уже закрытой ошибки (тот же fingerprint) — автоматически снова **открыта** (`resolved_at = null`), счётчик повторов увеличивается.
- Для ошибок с фронта сохраняются **ФИО** (`reporter_name`), **браузер** (`user_agent`), **версия клиента** (`app_version`); для бэкенда — **версия сервера** при записи.
- Список ошибок по умолчанию без фильтра по статусу (открытые и закрытые вместе).
- Сортировка колонок — по клику; без выбора пользователя — **последнее появление** (`last_seen_at` desc) на бэкенде.

### Онлайн-пользователи

- Heartbeat каждые **45 с** (`POST /api/monitoring/presence/heartbeat/`), в body — `current_path` и `from_app: true` (только UI Laborant; без флага presence не пишется).
- Онлайн = активность за последние **2 минуты**.
- Категория по приоритету (одна на пользователя): **лаборант** → **инженер** → **администратор** (типы из каталога ролей; админ — по флагу `is_admin`, не из `role_type`).
- Без ролей в каталоге (`laborant`/`engineer`) и без прав админа — **доступ запрещён** (`access_granted: false`), heartbeat не пишется.
- В сводке — чип: ФИО, роль, путь на второй строке.
- WebSocket не используется; данные в PostgreSQL (`user_presence`).

### Работоспособность

- `/api/health/` и сводка мониторинга: реальная проверка PostgreSQL (`SELECT 1`, время ответа).
- Статусы: **ok** (≤ 500 мс), **degraded** (> 500 мс), **down** (БД недоступна).
- В UI карточка «Статус работоспособности сервиса» + подпись «PostgreSQL · N мс».

### Период сводки и журнала

- Селектор: **24 часа** / **7 дней** / **30 дней** / **за всё время** (`all`); варианты и подписи — из `GET /api/monitoring/overview/` (`period_options`, `default_period`).
- Сводка: счётчик **новых ошибок** за период (`created_at`).
- Журнал: ошибки с активностью в период (`last_seen_at`).

### API

Все пути с префиксом `/api`.

| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/api/health/` | публичный (`status`, `db_latency_ms`) |
| GET | `/api/monitoring/overview/` | admin (`period`: 24h \| 7d \| 30d \| all; подписи фильтров в ответе) |
| GET | `/api/monitoring/errors/` | admin (фильтры: уровень, источник, статус, поиск, повторы, версия, последнее + `period`) |
| PATCH | `/api/monitoring/errors/{id}/status/` | admin (`resolved`, optional `comment`) |
| POST | `/api/monitoring/errors/cleanup-closed/` | admin (закрытые > 90 дней) |
| POST | `/api/monitoring/client-errors/` | авторизованный (`client_version`, `user_agent`) |
| POST | `/api/monitoring/presence/heartbeat/` | авторизованный (`current_path`, `from_app`) |

### Версии

- **Клиент:** `frontend/package.json` → `APP_VERSION` в сборке и в client-errors.
- **Сервер:** `backend/pyproject.toml` → `utils/app_version.get_app_version()`; при backend-ошибках пишется в `app_version` строки.
- На экране: «Сервер X · Клиент Y»; колонка «Версия» в журнале.

### UI

- Маршрут: `/monitoring` (группа «Администрирование»).
- Двухколоночный layout в `monitoring-page-panel`: **слева** сводка (период, активность, состояние, онлайн); **справа** журнал.
- Таблица `embedded`: рамка, `colgroup`, горизонтальный скролл при нехватке места (`min-width` ~720px).
- Колонки: уровень, источник, описание, повторы, версия, последнее, статус, действия.
- Фильтры в строке заголовка (в т.ч. повторы, версия, последнее появление); подписи селектов — из overview API.
- Сброс фильтров и **очистка закрытых >90 дней** над таблицей (подтверждение в `features/MonitoringCleanupConfirmModal`).
- Модалки: статус (`features/MonitoringErrorStatusModal`), детали (`features/MonitoringErrorDetailsModal`).
- Модалка деталей (`modalWidth="550"`): метаданные, пользователь/браузер (`browser` из API)/версия, комментарий при закрытии, сообщение, стек.
- Лоадер смены статуса — только у строки, на которой нажали.
- Скролл журнала внутри таблицы, не под navigation bar.

### Миграция

```bash
cd backend
alembic upgrade head
```

Миграция `b2c3d4e5f6a7` — поля enrichment в `monitoring_errors` и `current_path` в `user_presence`. Backfill старых строк не выполняется.

### Код

- Backend: `models/monitoring_error.py`, `models/user_presence.py`, `services/monitoring.py`, `services/health.py`, `api/monitoring.py`, `utils/database_health.py`, `utils/monitoring_period.py`, `utils/monitoring_labels.py`, `utils/monitoring_error_format.py`, `utils/app_version.py`.
- Frontend: `entities/Monitoring`, `features/Monitoring*Modal`, `widgets/MonitoringPanel`, `pages/MonitoringPage`, `app/AppErrorBoundary`, `app/PresenceHeartbeat` (внутри Router, `useLocation` для `current_path`).
- Запись backend-ошибок: `register_backend_monitoring_recorder` в `main.py` lifespan.

### Подходы к исправлениям (при внедрении и проверках)

Рекорд для следующих фич и добивки по `check.py` / ESLint / Steiger.

#### Backend — границы слоёв

| Проблема | Подход |
|----------|--------|
| `core` не может импортировать `services` (import-linter) | Callback в `core/exception_handlers.py`: `register_backend_monitoring_recorder`; wiring в `main.py` lifespan. Handler вызывает callback, не service. |
| `api` не импортирует `utils` | Health-check в `services/health.py` → `utils/database_health.py`; api вызывает только service. |
| `commit` только в `get_db` | Запись ошибки вне HTTP-транзакции — `run_isolated_transaction()` в `core/database.py`; service передаёт операцию, commit/rollback только в core. |
| `fastapi.Request` в service (basedpyright / слой) | Service получает `path: str` и `exc: BaseException`, не `Request`. |
| Ruff BLE001 — голый `except Exception` | Ловить явный tuple (`_MONITORING_RECORD_ERRORS`, `_HEALTH_CHECK_ERRORS`), не подавлять все исключения. |

#### Backend — exception handlers

| Проблема | Подход |
|----------|--------|
| `str(ResponseValidationError)` падает на ORM в теле ошибки | `_safe_exc_message()` и `_json_safe_value()` — безопасная сериализация для лога и JSON. |
| Запись в мониторинг не должна ломать HTTP-ответ | `_try_record_backend_monitoring_error` — отдельный try/except вокруг callback; при сбое только лог. |
| Что записывать | 500 / необработанные → severity `error`; `ResponseValidationError` → `critical`. 422, 404, 403, `/api/health/` — не записывать. |

#### Backend — repository / schemas / service

| Проблема | Подход |
|----------|--------|
| Pagination: optional `page` / `page_size` | `apply_pagination` только при `page is not None and page_size is not None`. |
| Upsert `user_presence` | Новая строка: `db.add` + `flush_entity`; обновление существующей — поля + `flush_entity`. |
| Audit-поля ORM ≠ поля ответа (`created_at` → `first_seen_at`) | `@model_validator(mode="before")` в `MonitoringErrorResponse` с `isinstance(value, MonitoringError)`. |
| Составной ответ со списком пользователей | Service собирает `PresenceStatsResponse`; элементы — `OnlineUserResponse.model_validate(user)`. |

#### Frontend — клиентский репорт ошибок

| Проблема | Подход |
|----------|--------|
| ESLint: `String(object)` / небезопасная сериализация | Явные ветки: `Error`, primitives, `JSON.stringify` с catch → `'[Unserializable]'`, symbol → `toString()`, function → `[Function: name]`, циклы → `'[Circular]'`. |
| Шторм одинаковых ошибок с клиента | In-memory dedupe по `severity + message` до отправки; на сервере — fingerprint в БД. |
| Длинный traceback / message | `compact_stack_trace` / `compact_error_message` в `utils/monitoring_error_format.py` при записи; клиент шлёт сырой текст в пределах лимитов схемы. |
| Петля: ошибка при отправке ошибки | `SKIP_URL_PARTS` для `/api/monitoring/client-errors/` и heartbeat; `catch(() => undefined)` на fetch. |
| React/antd Warning через `console.error` | `isConsoleWarningMessage` — префикс `Warning:` → severity `warning`. |
| `event.error` / `event.reason` в обработчиках | Проверка `instanceof Error`; остальное через `as unknown` и `serializeValue`. |
| 404 на API мониторинга | Пути клиента с префиксом `/api/...`, как у остальных entity. |
| Heartbeat и путь страницы | `app/PresenceHeartbeat` внутри Router; путь через `useLocation` в entity-hook. |

#### Frontend — FSD (Steiger)

| Проблема | Подход |
|----------|--------|
| `no-public-api-sidestep` | Импорт `APP_VERSION` из `@/shared/config`, не из `@/shared/config/appVersion`. |
| `no-ui-in-app` | Компоненты слоя `app` без сегмента `ui` — например `app/AppErrorBoundary.tsx`. |

#### Общий принцип

Побочный эффект (лог ошибки, heartbeat) изолирован от основной транзакции запроса и не меняет контракт ответа при сбое записи.

---

## Типы проб и цели испытаний

**Дата:** 09.09.2026

### Назначение

Два справочника в разделе «Справочники»: **Типы проб** и **Цели испытаний**. В пробе хранятся **названия строками** (как режим скважины), а не FK на справочник.

### Область видимости

- Записи привязаны к **лаборатории** и опционально к **подразделению**.
- UI: карточки Lab → Dept (как у норм НД / приборов), затем список.
- Уникальность названия — в рамках лаборатории/подразделения (только неудалённые).
- Seed типов проб при миграции — по каждой паре lab/dept; цели испытаний создаются пустым справочником.

### Удаление

- Только **мягкое** удаление (`deleted_at`).
- Списки и Select в форме пробы показывают только активные записи.
- Уже сохранённые пробы **не меняются**: строка `sample_type` / `test_purpose` остаётся. В Select удалённого значения уже нет.

### Проба — новые/связанные поля

Опциональные (права `samples.visible_fields`):

| Поле | Смысл |
|------|--------|
| `sample_type` | Тип пробы (строка из справочника) |
| `test_purpose` | Цель испытаний (строка из справочника) |
| `customer_activity_place` | Место осуществления деятельности заказчика |
| `test_object_nd` | НД на объект испытаний |

Порядок в форме: регистрационный номер → тип пробы → объект испытаний → НД на объект → цель испытаний → показатели → филиал → место деятельности заказчика → место отбора → скважина → режим → даты / кто добавил.

### Протокол — поля заявки / плана / акта отбора

Перенесены **с пробы на протокол** (миграция `e5f6a7b8c9d0`):

| Поле | Смысл |
|------|--------|
| `sampling_act_date` | Дата акта отбора |
| `sampling_request_number` | Номер заявки на отбор |
| `sampling_request_date` | Дата заявки |
| `sampling_method_nd` | НД на метод отбора |
| `sampling_plan_number` | Номер плана отбора |

Номер акта (`sampling_act_number`) на протоколе был и раньше (обязательный). Видимость новых полей — `protocols.visible_fields` / `PROTOCOL_OPTIONAL_FIELDS`. У существующих ролей по умолчанию **выкл.**

Порядок в форме протокола: номер/дата протокола → аккредитация → номер акта → дата акта → заявка (номер/дата) → НД метода → план → оформил/утвердил…

### Права и навигация

- Вкладки: `sample_types`, `test_purposes` в navigation + CRUD в матрице роли.
- Иконки сайдбара: типы — теги, цели — флаг, нормы НД — документ с защитой (у группы «Справочники» — книга).

### Миграции

```bash
cd backend
alembic upgrade head
```

- `c3d4e5f6a7b8` — таблицы справочников, поля на пробе (в т.ч. затем перенесённые), seed типов.
- `d4e5f6a7b8c9` — догоняющие audit hash-колонки справочников.
- `e5f6a7b8c9d0` — перенос пяти полей sample → protocol; перенос ключей в `roles.scopes.visible_fields`.

### Код

- Backend: `models/sample_type.py`, `models/test_purpose.py`, `api/sample_type.py`, `api/test_purpose.py`, `services/sample_type.py`, `services/test_purpose.py`, repositories/schemas; поля в `sample` / `protocol`; `PROTOCOL_OPTIONAL_FIELDS` в `utils/permissions_constants.py`.
- Frontend: `entities/SampleType`, `entities/TestPurpose`, `features/*SampleType*`, `features/*TestPurpose*`, `widgets/SampleTypesPanel`, `widgets/TestPurposesPanel`, `pages/SampleTypesPage`, `pages/TestPurposesPage`; формы Sample/Protocol; `RolePermissionsPanel`.

---

## Подсказки источников справочников

**Дата:** 16.09.2026

### Назначение

У полей, где варианты выбираются из справочника, иконка-подсказка объясняет, откуда берётся список, и ведёт на страницу справочника (с учётом лаборатории и подразделения, если они есть в контексте формы).

### Текст

- Есть доступ: «Варианты в этом списке берутся из справочника на странице «…»» + ссылка.
- Нет доступа: то же без ссылки + «У вас нет доступа к этой странице. Обратитесь к инженеру лаборатории или администратору системы».
- Нет доступа и тип роли `engineer`: обращаться только к администратору системы.

### Подсказки «откуда варианты списка» (DictionarySourceHint)

- Проба: тип, объект испытаний, цель, филиал, место отбора, режим/точка отбора.
- Нормы НД: объект испытаний.
- Метод исследования: типы (теги объектов испытаний).
- Объект испытаний: область видимости (лаборатории/подразделения).
- Приборы по умолчанию (модалка у метода); приборы при сохранении расчёта.

Без подсказки источника (по решению): чекбоксы методов в форме прибора; чекбоксы методов в группе метода исследования; выбор лабораторий/подразделений на странице прав роли.

### Полевые подсказки ввода (иконка у label)

- Проба — количество показателей: «Сколько показателей планируется определить по этой пробе. Учитывается в отчётах лаборатории.»
- Проба — скважина (только если поле видно): «Вводите только номер скважины, без символа №.» (для точки отбора — без такой подсказки).
- Протокол — номер протокола испытаний: «Вводите только номер, без суффиксов вроде /07/дк.»
- Протокол — номер заявки на отбор пробы (если поле включено в правах): «Вводите только номер заявки, без символа №.»
- Проба — условия отбора: «Состав полей условий отбора настраивает администратор системы. Если нужно изменить набор полей — обратитесь к администратору.»

### Назначение страниц справочников (PageHint)

Под `NavigationBar` на рабочем уровне справочника: после выбора лаборатории и подразделения (если у лаборатории есть подразделения) или сразу после выбора лаборатории (если подразделений нет). На экранах выбора лаборатории и подразделения подсказка не показывается. Тексты в `shared/lib/dictionaryPageHints.ts`, UI — `shared/ui/PageHint`.

| Раздел | Маршрут | Текст |
|--------|---------|--------|
| Типы проб | `/sample-types` | Необходим для выбора типа пробы при добавлении или редактировании пробы. |
| Цели испытаний | `/test-purposes` | Необходим для выбора цели испытаний при добавлении или редактировании пробы. |
| Места отбора проб | `/sampling-locations` | Необходим для выбора филиала, места отбора и «режим скважины» / «точки отбора» / «режим скважины/точки отбора» — по `sampling_terminology` роли (для администратора — оба через `/`). |
| Приборы | `/equipment` | Необходим для выбора приборов при сохранении расчёта и для приборов по умолчанию у методов исследования. |
| Нормы НД | `/nd-norms` | Необходим для хранения текстов норм по методам исследования для выбранного объекта испытаний. |
| Градуировочный график | `/refraction-tables` | Необходим для таблиц, используемых в расчётах массовой доли нефти. |
| Объекты испытаний | `/test-objects` | Необходим для выбора объекта испытаний при добавлении или редактировании пробы, норм НД и методов исследования. |

### Код

- Подсказки списков: `entities/Role` — `DictionarySourceHint`, `lib/dictionarySourceHint.ts`.
- Поля форм: `FormField` / `FormItem` — `tooltip` как `ReactNode`.
- Страницы справочников: `shared/lib/dictionaryPageHints.ts`, `shared/ui/PageHint`; панели `*Panel` в `widgets/`.

