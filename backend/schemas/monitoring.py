from __future__ import annotations
from datetime import datetime
from typing import Annotated, Literal
from pydantic import AfterValidator, AliasChoices, BaseModel, ConfigDict, Field, computed_field
from models.monitoring_error import MonitoringErrorSeverity, MonitoringErrorSource
from models.user_presence import PresenceCategory
from schemas.common import make_enum_validator
from utils.format_short_browser import format_short_browser
from utils.monitoring_period import MonitoringPeriodValue

_validate_monitoring_severity = make_enum_validator(MonitoringErrorSeverity, "Уровень ошибки")
_validate_monitoring_source = make_enum_validator(MonitoringErrorSource, "Источник ошибки")
_validate_presence_category = make_enum_validator(PresenceCategory, "Категория присутствия")

MonitoringSeverityField = Annotated[str, AfterValidator(_validate_monitoring_severity)]
MonitoringSourceField = Annotated[str, AfterValidator(_validate_monitoring_source)]
PresenceCategoryField = Annotated[str, AfterValidator(_validate_presence_category)]

MonitoringPeriod = MonitoringPeriodValue
HealthStatus = Literal["ok", "degraded", "down"]


class ClientErrorReportCreate(BaseModel):
    """Репорт ошибки с фронтенда."""

    severity: MonitoringSeverityField
    message: str = Field(..., max_length=2000)
    stack_trace: str | None = Field(None, max_length=8000)
    url: str | None = Field(None, max_length=2000)
    user_agent: str | None = Field(None, max_length=500)
    client_version: str | None = Field(None, max_length=40)


class HeartbeatCreate(BaseModel):
    """Heartbeat присутствия пользователя."""

    current_path: str | None = Field(None, max_length=500)
    from_app: bool = Field(
        False,
        description="True только от UI приложения; без флага presence не обновляется",
    )


class MonitoringErrorResponse(BaseModel):
    """Ошибка мониторинга для списка и деталей."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    severity: MonitoringSeverityField
    source: MonitoringSourceField
    message: str
    summary: str
    stack_trace: str | None
    path: str | None
    exception_type: str | None
    occurrence_count: int
    first_seen_at: datetime = Field(validation_alias=AliasChoices("first_seen_at", "created_at"))
    last_seen_at: datetime = Field(validation_alias=AliasChoices("last_seen_at", "updated_at"))
    resolved_at: datetime | None
    reporter_name: str | None
    user_agent: str | None = Field(None, exclude=True)
    app_version: str | None
    resolved_by_name: str | None
    resolve_comment: str | None

    @computed_field
    @property
    def browser(self) -> str | None:
        return format_short_browser(self.user_agent)


class OnlineUserResponse(BaseModel):
    """Пользователь в списке онлайн."""

    model_config = ConfigDict(from_attributes=True)

    full_name: str
    presence_category: PresenceCategoryField
    last_seen_at: datetime
    current_path: str | None


class PresenceStatsResponse(BaseModel):
    """Счётчики онлайн-пользователей."""

    total: int
    laborant: int
    engineer: int
    admin: int
    online_users: list[OnlineUserResponse]


class MonitoringOptionResponse(BaseModel):
    """Вариант выбора для UI мониторинга: value + подпись."""

    value: str
    label: str


class MonitoringOverviewResponse(BaseModel):
    """Сводка для страницы мониторинга."""

    health_status: HealthStatus
    db_latency_ms: float | None
    app_version: str
    period: MonitoringPeriod
    default_period: MonitoringPeriod
    period_options: list[MonitoringOptionResponse]
    severity_options: list[MonitoringOptionResponse]
    source_options: list[MonitoringOptionResponse]
    resolved_options: list[MonitoringOptionResponse]
    health_options: list[MonitoringOptionResponse]
    presence_options: list[MonitoringOptionResponse]
    new_errors_count: int
    presence: PresenceStatsResponse


class MonitoringMessageResponse(BaseModel):
    """Короткий ответ без данных."""

    message: str


class MonitoringCleanupResponse(BaseModel):
    """Результат очистки закрытых ошибок."""

    message: str
    deleted_count: int


class MonitoringErrorStatusUpdate(BaseModel):
    """Изменение статуса ошибки мониторинга."""

    resolved: bool
    comment: str | None = Field(None, max_length=500)
