import dayjs, { type Dayjs } from 'dayjs';

export interface DateRangePreset {
  label: string;
  value: [Dayjs, Dayjs];
}

/**
 * Генерирует presets для RangePicker с быстрым выбором диапазонов дат
 */
export const getDateRangePresets = (): DateRangePreset[] => {
  const today = dayjs();
  const startOfToday = today.startOf('day');
  const endOfToday = today.endOf('day');

  // Сегодня
  const todayPreset: DateRangePreset = {
    label: 'Сегодня',
    value: [startOfToday, endOfToday],
  };

  // Предыдущий день (вчера)
  const yesterdayPreset: DateRangePreset = {
    label: 'Предыдущий день',
    value: [
      today.clone().subtract(1, 'day').startOf('day'),
      today.clone().subtract(1, 'day').endOf('day'),
    ],
  };

  // Неделя (с понедельника по воскресенье текущей недели)
  const weekPreset: DateRangePreset = {
    label: 'Неделя',
    value: [today.clone().startOf('week'), today.clone().endOf('week')],
  };

  // Прошлая неделя
  const lastWeekPreset: DateRangePreset = {
    label: 'Прошлая неделя',
    value: [
      today.clone().subtract(1, 'week').startOf('week'),
      today.clone().subtract(1, 'week').endOf('week'),
    ],
  };

  // Месяц (текущий месяц)
  const monthPreset: DateRangePreset = {
    label: 'Месяц',
    value: [today.clone().startOf('month'), today.clone().endOf('month')],
  };

  // Предыдущий месяц
  const lastMonthPreset: DateRangePreset = {
    label: 'Предыдущий месяц',
    value: [
      today.clone().subtract(1, 'month').startOf('month'),
      today.clone().subtract(1, 'month').endOf('month'),
    ],
  };

  // Последние 3 месяца
  const last3MonthsPreset: DateRangePreset = {
    label: 'Последние 3 месяца',
    value: [today.clone().subtract(2, 'month').startOf('month'), today.clone().endOf('month')],
  };

  // Первое полугодие (январь-июнь)
  const firstHalfYearPreset: DateRangePreset = {
    label: 'Первое полугодие',
    value: [
      today.clone().month(0).startOf('month').startOf('day'),
      today.clone().month(5).endOf('month').endOf('day'),
    ],
  };

  // Второе полугодие (июль-декабрь)
  const secondHalfYearPreset: DateRangePreset = {
    label: 'Второе полугодие',
    value: [
      today.clone().month(6).startOf('month').startOf('day'),
      today.clone().month(11).endOf('month').endOf('day'),
    ],
  };

  // Год (текущий год)
  const yearPreset: DateRangePreset = {
    label: 'Год',
    value: [today.clone().startOf('year'), today.clone().endOf('year')],
  };

  // Прошлый год
  const lastYearPreset: DateRangePreset = {
    label: 'Прошлый год',
    value: [
      today.clone().subtract(1, 'year').startOf('year'),
      today.clone().subtract(1, 'year').endOf('year'),
    ],
  };

  // Кварталы текущего года
  const quarter1Preset: DateRangePreset = {
    label: '1 квартал',
    value: [
      today.clone().month(0).startOf('month').startOf('day'),
      today.clone().month(2).endOf('month').endOf('day'),
    ],
  };

  const quarter2Preset: DateRangePreset = {
    label: '2 квартал',
    value: [
      today.clone().month(3).startOf('month').startOf('day'),
      today.clone().month(5).endOf('month').endOf('day'),
    ],
  };

  const quarter3Preset: DateRangePreset = {
    label: '3 квартал',
    value: [
      today.clone().month(6).startOf('month').startOf('day'),
      today.clone().month(8).endOf('month').endOf('day'),
    ],
  };

  const quarter4Preset: DateRangePreset = {
    label: '4 квартал',
    value: [
      today.clone().month(9).startOf('month').startOf('day'),
      today.clone().month(11).endOf('month').endOf('day'),
    ],
  };

  return [
    todayPreset,
    yesterdayPreset,
    weekPreset,
    lastWeekPreset,
    monthPreset,
    lastMonthPreset,
    last3MonthsPreset,
    firstHalfYearPreset,
    secondHalfYearPreset,
    yearPreset,
    lastYearPreset,
    quarter1Preset,
    quarter2Preset,
    quarter3Preset,
    quarter4Preset,
  ];
};
