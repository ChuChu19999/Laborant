import React, { useRef, useEffect } from 'react';
import { DatePicker as AntDatePicker, ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import 'dayjs/locale/ru';

dayjs.extend(customParseFormat);
dayjs.locale('ru');

const { RangePicker: AntRangePicker } = AntDatePicker;

interface DatePickerProps extends React.ComponentProps<typeof AntDatePicker> {
  className?: string;
}

interface RangePickerProps extends React.ComponentProps<typeof AntRangePicker> {
  className?: string;
}

// Функция для форматирования ввода по маске DD.MM.YYYY
const formatDateInput = (value: string): string => {
  const digits = value.replace(/\D/g, '');

  const limitedDigits = digits.slice(0, 8);

  let formatted = '';
  for (let i = 0; i < limitedDigits.length; i++) {
    if (i === 2 || i === 4) {
      formatted += '.';
    }
    formatted += limitedDigits[i];
  }

  return formatted;
};

// Функция для обработки ввода с маской
const handleDateInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
  const input = e.currentTarget;
  const key = e.key;

  // Разрешаем управляющие клавиши
  if (
    key === 'Backspace' ||
    key === 'Delete' ||
    key === 'Tab' ||
    key === 'Escape' ||
    key === 'Enter' ||
    key === 'ArrowLeft' ||
    key === 'ArrowRight' ||
    key === 'ArrowUp' ||
    key === 'ArrowDown' ||
    (e.ctrlKey && (key === 'a' || key === 'c' || key === 'v' || key === 'x'))
  ) {
    return;
  }

  // Блокируем все нецифровые символы
  if (!/^\d$/.test(key)) {
    e.preventDefault();
    return;
  }

  // Получаем текущее значение и позицию курсора
  const currentValue = input.value || '';
  const currentCursorPos = input.selectionStart || 0;
  const digits = currentValue.replace(/\D/g, '');

  // Если уже 8 цифр, блокируем ввод
  if (digits.length >= 8) {
    e.preventDefault();
    return;
  }

  // Подсчитываем количество цифр до позиции курсора
  const digitsBeforeCursor = currentValue.substring(0, currentCursorPos).replace(/\D/g, '').length;

  // Форматируем значение после ввода
  setTimeout(() => {
    const newValue = input.value || '';
    const formatted = formatDateInput(newValue);
    input.value = formatted;

    // Вычисляем новую позицию курсора
    // Нужно найти позицию, где находится (digitsBeforeCursor + 1) цифра
    const targetDigitsCount = digitsBeforeCursor + 1;
    let digitCount = 0;
    let newPosition = formatted.length;

    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) {
        digitCount++;
        // Если достигли нужного количества цифр, ставим курсор после этой цифры
        if (digitCount === targetDigitsCount) {
          newPosition = i + 1;
          // Если следующая позиция - точка, пропускаем ее
          if (i + 1 < formatted.length && formatted[i + 1] === '.') {
            newPosition = i + 2;
          }
          break;
        }
      }
    }

    input.setSelectionRange(newPosition, newPosition);
  }, 0);
};

const DatePicker = (props: DatePickerProps) => {
  const { format, inputReadOnly, onChange, ...restProps } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    // Находим input элемент внутри DatePicker через DOM
    const findAndAttachMask = () => {
      if (containerRef.current) {
        const input = containerRef.current.querySelector('input');
        if (input) {
          // Добавляем обработчик для маски ввода
          const handleKeyDown = (e: KeyboardEvent) => {
            handleDateInput(e as unknown as React.KeyboardEvent<HTMLInputElement>);
          };

          // Добавляем обработчик для форматирования при вставке
          const handleInput = (e: Event) => {
            const target = e.target as HTMLInputElement;
            if (target && target.value) {
              const formatted = formatDateInput(target.value);
              if (formatted !== target.value) {
                const start = target.selectionStart || 0;
                target.value = formatted;
                const newPosition = Math.min(start, formatted.length);
                target.setSelectionRange(newPosition, newPosition);
              }
            }
          };

          input.addEventListener('keydown', handleKeyDown);
          input.addEventListener('input', handleInput);

          cleanup = () => {
            input.removeEventListener('keydown', handleKeyDown);
            input.removeEventListener('input', handleInput);
          };
        }
      }
    };

    // Небольшая задержка для того, чтобы компонент успел отрендериться
    const timeoutId = setTimeout(() => {
      findAndAttachMask();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  const handleChange = (date: unknown, dateString: string | string[]) => {
    if (onChange) {
      onChange(date, dateString);
    }
  };

  return (
    <ConfigProvider locale={ruRU}>
      <div ref={containerRef}>
        <AntDatePicker
          className={props.className || 'date-picker'}
          format={format || 'DD.MM.YYYY'}
          inputReadOnly={inputReadOnly ?? false}
          onChange={handleChange}
          {...restProps}
        />
      </div>
    </ConfigProvider>
  );
};

const RangePicker = (props: RangePickerProps) => {
  const { format, inputReadOnly, onChange, ...restProps } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    // Находим input элементы внутри RangePicker через DOM
    const findAndAttachMask = () => {
      if (containerRef.current) {
        const inputs = containerRef.current.querySelectorAll('input');

        if (inputs.length > 0) {
          // Добавляем обработчики для каждого input
          const handleKeyDown = (e: KeyboardEvent) => {
            handleDateInput(e as unknown as React.KeyboardEvent<HTMLInputElement>);
          };

          // Добавляем обработчик для форматирования при вставке
          const handleInput = (e: Event) => {
            const target = e.target as HTMLInputElement;
            if (target && target.value) {
              const formatted = formatDateInput(target.value);
              if (formatted !== target.value) {
                const start = target.selectionStart || 0;
                target.value = formatted;
                const newPosition = Math.min(start, formatted.length);
                target.setSelectionRange(newPosition, newPosition);
              }
            }
          };

          inputs.forEach(input => {
            input.addEventListener('keydown', handleKeyDown);
            input.addEventListener('input', handleInput);
          });

          cleanup = () => {
            inputs.forEach(input => {
              input.removeEventListener('keydown', handleKeyDown);
              input.removeEventListener('input', handleInput);
            });
          };
        }
      }
    };

    // Небольшая задержка для того, чтобы компонент успел отрендериться
    const timeoutId = setTimeout(() => {
      findAndAttachMask();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  const handleChange: RangePickerProps['onChange'] = (dates, dateStrings) => {
    if (onChange) {
      onChange(dates, dateStrings);
    }
  };

  return (
    <ConfigProvider locale={ruRU}>
      <div ref={containerRef}>
        <AntRangePicker
          className={props.className || 'date-range-picker'}
          format={format || 'DD.MM.YYYY'}
          inputReadOnly={inputReadOnly ?? false}
          onChange={handleChange}
          {...restProps}
        />
      </div>
    </ConfigProvider>
  );
};

export default DatePicker;
export { RangePicker };
