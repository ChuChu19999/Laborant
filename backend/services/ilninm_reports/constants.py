# Лаборатория, для которой доступны отчёты ИЛНиНМ.
LABORATORY_NAME_ILNINM = "ИЛНиНМ"

# Названия филиалов для фильтрации по branch.name.
BRANCH_NGDU = "НГДУ"
BRANCH_UGPU = "УГПУ"
BRANCH_GPU_PRAO = "ГПУпРАО"

# Места отбора: цехи ДГГКН (для товарной/эксплуатационной/калибровочной нефти).
SAMPLING_LOCATION_CDGGKN_1 = "Цех по ДГГКН №1"
SAMPLING_LOCATION_CDGGKN_2 = "Цех по ДГГКН №2"
SAMPLING_LOCATIONS_CDGGKN = (SAMPLING_LOCATION_CDGGKN_1, SAMPLING_LOCATION_CDGGKN_2)

# Краткие названия мест отбора для вывода в отчёт.
SAMPLING_LOCATION_DISPLAY_CDGGKN_1 = "ЦДГГКН №1"
SAMPLING_LOCATION_DISPLAY_CDGGKN_2 = "ЦДГГКН №2"
DISPLAY_NAMES_CDGGKN = {
    "Цех по ДГГКН №1": SAMPLING_LOCATION_DISPLAY_CDGGKN_1,
    "Цех по ДГГКН №2": SAMPLING_LOCATION_DISPLAY_CDGGKN_2,
}

# Места отбора ГКП - части имени.
GKP_SAMPLING_NAME_PREFIX_21 = "ГКП-21"
GKP_SAMPLING_NAME_PREFIX_22 = "ГКП-22"

# Места отбора УКПГ для строки «Товарная продукция ОИС» (по началу имени, как ГКП).
UKPG_SAMPLING_NAME_PREFIX_21 = "УКПГ-21"
UKPG_SAMPLING_NAME_PREFIX_22 = "УКПГ-22"

# Префиксы мест отбора в «Товарная продукция ОИС»: ГКП и УКПГ-21/22.
TOVARNAYA_PRODUKCIYA_OIS_SAMPLING_PREFIXES = (
    GKP_SAMPLING_NAME_PREFIX_21,
    GKP_SAMPLING_NAME_PREFIX_22,
    UKPG_SAMPLING_NAME_PREFIX_21,
    UKPG_SAMPLING_NAME_PREFIX_22,
)

# Место отбора для строки «ОИС Ен-Яха» (префикс имени).
SAMPLING_LOCATION_UKPG_11V = "УКПГ-11В"

# Строка «ОИС Валанжин» — только пробы с местом отбора по УКПГ-1АВ, УКПГ-1В, УКПГ-2В, УКПГ-5В, УКПГ-8В;
# в прочие строки ОИС они не включаются. Длинные названия (например «УКПГ-2В НСПК УУКГН»)
# — в sample_count._is_valanzhin_ukpg_sampling_location.
SAMPLING_LOCATION_PREFIXES_VALANZHIN_UKPG = (
    "УКПГ-1АВ",
    "УКПГ-1В",
    "УКПГ-2В",
    "УКПГ-5В",
    "УКПГ-8В",
)

# Совместимость префиксов ГКП.
SAMPLING_LOCATION_GKP_21 = GKP_SAMPLING_NAME_PREFIX_21
SAMPLING_LOCATION_GKP_22 = GKP_SAMPLING_NAME_PREFIX_22
SAMPLING_LOCATIONS_GKP = (SAMPLING_LOCATION_GKP_21, SAMPLING_LOCATION_GKP_22)

# Тип пробы для строки «Внеплановые».
SAMPLE_TYPE_VNEPLANOVYE = "Внеплановые"

# Ключи строк отчёта «Количество проб» (значения столбца A для сопоставления).
ROW_TITLE_TOVARNAYA_NEFT_NGDU = "Товарная нефть НГДУ"
ROW_TITLE_EKSPLUATACIONNAYA_NEFT_NGDU = "Эксплуатационная нефть НГДУ"
ROW_TITLE_KALIBROVOCHNAYA_NEFT_UGPU = "Калибровочная нефть УГПУ"
ROW_TITLE_VNEPLANOVYE = "Внеплановые"
ROW_TITLE_PASPORTIZACIYA = "Паспортизация"
ROW_TITLE_GKP_21_GKP_22 = "ГКП-21 ГКП-22"
ROW_TITLE_OIS_ACHIMOVKA = "ОИС Ачимовка"
ROW_TITLE_OIS_VALANZHIN = "ОИС Валанжин"
ROW_TITLE_OIS_EN_YAHA = "ОИС Ен-Яха"
ROW_TITLE_OIS = "ОИС"
ROW_TITLE_TOVARNAYA_PRODUKCIYA_OIS = "Товарная продукция ОИС"
ROW_TITLE_PROCHIE = "Прочие"
ROW_TITLE_NEFTECONDENSATNAYA_SMES = "Нефтеконденсатная смесь"
ROW_TITLE_DIZTOPIVO = "Дизтопливо"
ROW_TITLE_INGIBITOR = "Ингибитор коррозии"

# Отчёт «Количество проб»: шапка (не участвует в строках категорий).
SAMPLE_COUNT_TEMPLATE_HEADER_ROW_COUNT = 3
SAMPLE_COUNT_PLACEHOLDER_PERIOD = "{period}"
SAMPLE_COUNT_PLACEHOLDER_KOL_VO = "{kol-vo}"

# Отчёт «Физико-химическая характеристика».
REPORT_EMPTY_CELL_VALUE = "-"

PHYSICOCHEMICAL_TEMPLATE_HEADER_ROW = 1
PHYSICOCHEMICAL_TEMPLATE_HEADER_LAST_ROW = 5
PHYSICOCHEMICAL_TEMPLATE_DATA_ROW = 6
PHYSICOCHEMICAL_PLACEHOLDER_PERIOD = "{period}"
PHYSICOCHEMICAL_PLACEHOLDER_SAMPLING_LOCATION = "{sampling_location}"

PHYSICOCHEMICAL_SAMPLING_LOCATION_OPTIONS = (
    SAMPLING_LOCATION_DISPLAY_CDGGKN_1,
    SAMPLING_LOCATION_DISPLAY_CDGGKN_2,
)

DB_NAME_TO_DISPLAY_CDGGKN = DISPLAY_NAMES_CDGGKN
DISPLAY_TO_DB_NAME_CDGGKN = {
    SAMPLING_LOCATION_DISPLAY_CDGGKN_1: SAMPLING_LOCATION_CDGGKN_1,
    SAMPLING_LOCATION_DISPLAY_CDGGKN_2: SAMPLING_LOCATION_CDGGKN_2,
    SAMPLING_LOCATION_CDGGKN_1: SAMPLING_LOCATION_CDGGKN_1,
    SAMPLING_LOCATION_CDGGKN_2: SAMPLING_LOCATION_CDGGKN_2,
}

GROUP_DENSITY = "Плотность при температуре °C"
GROUP_MOLECULAR_MASS = "Молекулярная масса"
GROUP_KINEMATIC_VISCOSITY = "Вязкость кинематическая"
GROUP_FRACTIONAL = "Фракционный состав"

METHOD_DENSITY_OIL = "Нефть"
METHOD_MOLECULAR_OIL = "Нефть"
METHOD_VISCOSITY_20 = "при 20 °C"
METHOD_VISCOSITY_50 = "при 50 °C"
METHOD_FREEZING_TEMP = "Температура застывания"
METHOD_FRACTIONAL_OIL = "Фракционный состав (нефть)"
METHOD_ASPHALTENES = "Массовая доля асфальтенов"
METHOD_MECHANICAL_IMPURITIES = "Массовая доля механических примесей"
METHOD_PARAFFIN = "Массовая доля парафина"
METHOD_PARAFFIN_MELTING = "Температура плавления парафина"

FRACTIONAL_RESULT_FIELD_NK = "Температура н.к."
FRACTIONAL_RESULT_FIELD_100 = "Выход фракций до 100 ℃"
FRACTIONAL_RESULT_FIELD_150 = "Выход фракций до 150 ℃"
FRACTIONAL_RESULT_FIELD_200 = "Выход фракций до 200 ℃"
FRACTIONAL_RESULT_FIELD_250 = "Выход фракций до 250 ℃"
FRACTIONAL_RESULT_FIELD_270 = "Выход фракций до 270 ℃"
FRACTIONAL_RESULT_FIELD_300 = "Выход фракций до 300 ℃"

METHOD_CONDENSATE = "Конденсат"
METHOD_WATER_MASS_FRACTION = "Массовая доля воды"
METHOD_CHLORIDE_SALTS = "Массовая концентрация хлористых солей"

SAMPLE_TYPE_PASPORTIZACIYA = "Паспортизация"
TEST_OBJECT_DEGASSED_CONDENSATE = "дегазированный конденсат"

KGS_AVERAGE_ROW_LABEL = "Среднее зн."
KGS_TEMPLATE_HEADER_LAST_ROW = 17
KGS_TEMPLATE_DATA_ROW = 18
KGS_PLACEHOLDER_PERIOD = "{period}"

KGS_SAMPLING_LOCATION_PREFIXES = (
    *SAMPLING_LOCATION_PREFIXES_VALANZHIN_UKPG,
    SAMPLING_LOCATION_UKPG_11V,
    UKPG_SAMPLING_NAME_PREFIX_21,
    UKPG_SAMPLING_NAME_PREFIX_22,
    GKP_SAMPLING_NAME_PREFIX_21,
    GKP_SAMPLING_NAME_PREFIX_22,
)

# Отчёт «Результаты НКС».
TEST_OBJECT_NKS_MIXTURE = "нефтеконденсатная смесь"
NKS_TEMPLATE_HEADER_LAST_ROW = 18
NKS_TEMPLATE_DATA_ROW = 19
NKS_PLACEHOLDER_PERIOD = "{period}"

GROUP_MASS_FRACTION_OIL = "Массовая доля нефти"
GROUP_DENSITY_20 = "Плотность при температуре 20 °C"
METHOD_MASS_FRACTION_OIL = "Массовая доля нефти"
METHOD_FRACTIONAL_CONDENSATE = "Фракционный состав (конденсат)"

NKS_MF_OIL_COLOR_FIELD = "Цвет"
NKS_FS_FIELD_NK = "Температура н.к."
NKS_FS_FIELD_10 = "10% отгона при температуре"
NKS_FS_FIELD_50 = "50% отгона при температуре"
NKS_FS_FIELD_90 = "90% отгона при температуре"
NKS_FS_FIELD_END_BOIL = "Температура к.к."
NKS_FS_FIELD_DISTILLATE = "Объемная доля отгона"
NKS_FS_FIELD_RESIDUE = "Объемная доля остатка"
NKS_FS_FIELD_LOSSES = "Объемная доля потерь"

NKS_COL_LAB_ACTIVITY = 4
NKS_COL_PRESSURE = 5
NKS_COL_TEMPERATURE = 6
NKS_COL_COLOR = 7
NKS_COL_DENSITY = 8
NKS_COL_FS_START = 9
NKS_COL_FS_10 = 10
NKS_COL_FS_50 = 11
NKS_COL_FS_90 = 12
NKS_COL_FS_END = 13
NKS_COL_FS_DISTILLATE = 14
NKS_COL_FS_RESIDUE = 15
NKS_COL_FS_LOSSES = 16
NKS_COL_MASS_FRACTION = 17
NKS_COL_PLUS_MINUS = 18
NKS_COL_MEASUREMENT_ERROR = 19
NKS_MAX_COLUMN = 19
