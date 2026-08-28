from __future__ import annotations
from models.equipment import EquipmentType

# Подписи типов приборов.
EQUIPMENT_TYPE_DISPLAY: dict[str, str] = {
    EquipmentType.TEST_EQUIPMENT.value: "Испытательное оборудование",
    EquipmentType.MEASURING_INSTRUMENT.value: "Средство измерения",
}
