from __future__ import annotations

MONITORING_PERIOD_OPTIONS: tuple[tuple[str, str], ...] = (
    ("24h", "24 часа"),
    ("7d", "7 дней"),
    ("30d", "30 дней"),
    ("all", "За всё время"),
)

MONITORING_SEVERITY_OPTIONS: tuple[tuple[str, str], ...] = (
    ("warning", "Предупреждение"),
    ("error", "Ошибка"),
    ("critical", "Критическая"),
)

MONITORING_SOURCE_OPTIONS: tuple[tuple[str, str], ...] = (
    ("backend", "Бэкенд"),
    ("frontend", "Фронтенд"),
)

MONITORING_RESOLVED_OPTIONS: tuple[tuple[str, str], ...] = (
    ("open", "Открытые"),
    ("closed", "Закрытые"),
)

HEALTH_STATUS_OPTIONS: tuple[tuple[str, str], ...] = (
    ("ok", "Работает"),
    ("degraded", "Замедление"),
    ("down", "Недоступен"),
)

PRESENCE_CATEGORY_OPTIONS: tuple[tuple[str, str], ...] = (
    ("laborant", "Лаборант"),
    ("engineer", "Инженер"),
    ("admin", "Администратор"),
)
