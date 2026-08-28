class BusinessLogicError(Exception):
    """Базовое исключение для ошибок бизнес-логики."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(self.message)


class NotFoundError(BusinessLogicError):
    """Исключение для случаев, когда ресурс не найден."""


class DomainValidationError(BusinessLogicError):
    """Исключение для ошибок доменной валидации."""


class ConflictError(BusinessLogicError):
    """Исключение для конфликтов (дублирование, нарушение ограничений)."""


class ForbiddenError(BusinessLogicError):
    """Исключение при отказе в доступе."""

    def __init__(self, message: str = "Отказано в доступе"):
        super().__init__(message)


class ServiceUnavailableError(BusinessLogicError):
    """Исключение при недоступности внешнего сервиса."""
