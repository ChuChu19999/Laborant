# FEATURES

Журнал новых возможностей приложения.

---

## Мониторинг (admin)

**Дата:** 28.08.2026

### Назначение

Страница «Мониторинг» для администратора: уникальные ошибки backend и frontend, счётчики пользователей онлайн, сводка состояния сервиса и БД.

### Ошибки

- Уровни: **предупреждение**, **ошибка**, **критическая**.
- Источники: **бэкенд** (необработанные 500, `ResponseValidationError`) и **фронтенд** (`console.warn/error`, `window.error`, `unhandledrejection`, Error Boundary).
- Дедупликация по fingerprint (SHA-256 нормализованного пути, сообщения и верхней строки стека); при повторе — `occurrence_count++`, без новой строки в БД.
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

- Heartbeat каждые **45 с** (`POST /api/monitoring/presence/heartbeat/`), в body — `current_path` (текущий путь страницы).
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
| POST | `/api/monitoring/presence/heartbeat/` | авторизованный (`current_path`) |

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
