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

# Тип пробы для строки «Внеплановая нефть».
SAMPLE_TYPE_VNEPLANOVYE = "Внеплановые"

# Ключи строк отчёта «Количество проб» (значения столбца A для сопоставления).
ROW_TITLE_TOVARNAYA_NEFT_NGDU = "Товарная нефть НГДУ"
ROW_TITLE_EKSPLUATACIONNAYA_NEFT_NGDU = "Эксплуатационная нефть НГДУ"
ROW_TITLE_KALIBROVOCHNAYA_NEFT_UGPU = "Калибровочная нефть УГПУ"
ROW_TITLE_VNEPLANOVAYA_NEFT = "Внеплановая нефть"
ROW_TITLE_PASPORTIZACIYA = "Паспортизация"
ROW_TITLE_GKP_21_GKP_22 = "ГКП-21 ГКП-22"
ROW_TITLE_OIS_ACHIMOVKA = "ОИС Ачимовка"
ROW_TITLE_OIS_VALANZHIN = "ОИС Валанжин"
ROW_TITLE_OIS_EN_YAHA = "ОИС Ен-Яха"
ROW_TITLE_OIS = "ОИС"
ROW_TITLE_TOVARNAYA_PRODUKCIYA_OIS = "Товарная продукция ОИС"
ROW_TITLE_PROCHIE = "Прочие"
ROW_TITLE_NEFTECONDENSATNAYA_SMES = "Нефтеконденсатная смесь"
ROW_TITLE_DIZTOPIVO_INGIBITOR = "Дизтопливо Ингибитор коррозии"
