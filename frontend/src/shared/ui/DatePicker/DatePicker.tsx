import React, { useRef, useEffect } from 'react';
import { DatePicker as AntDatePicker, ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import 'dayjs/locale/ru';
import { getDateRangePresets } from '../../lib/datePresets';
import type { DatePickerProps as AntDatePickerProps } from 'antd';
import './DatePicker.css';

dayjs.extend(customParseFormat);
dayjs.locale('ru');

const { RangePicker: AntRangePicker } = AntDatePicker;

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

const handleDateInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
  const input = e.currentTarget;
  const key = e.key;

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

  if (!/^\d$/.test(key)) {
    e.preventDefault();
    return;
  }

  const currentValue = input.value || '';
  const currentCursorPos = input.selectionStart || 0;
  const digits = currentValue.replace(/\D/g, '');

  if (digits.length >= 8) {
    e.preventDefault();
    return;
  }

  const digitsBeforeCursor = currentValue.substring(0, currentCursorPos).replace(/\D/g, '').length;

  setTimeout(() => {
    const newValue = input.value || '';
    const formatted = formatDateInput(newValue);
    input.value = formatted;

    const targetDigitsCount = digitsBeforeCursor + 1;
    let digitCount = 0;
    let newPosition = formatted.length;

    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) {
        digitCount++;
        if (digitCount === targetDigitsCount) {
          newPosition = i + 1;
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

interface DatePickerProps extends Omit<AntDatePickerProps, 'presets'> {
  className?: string;
  disableYearNavigation?: boolean;
}

interface RangePickerProps extends Omit<React.ComponentProps<typeof AntRangePicker>, 'presets'> {
  className?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({
  format,
  inputReadOnly,
  onChange,
  className,
  disableYearNavigation = true,
  ...restProps
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const findAndAttachMask = () => {
      if (containerRef.current) {
        const input = containerRef.current.querySelector('input');
        if (input) {
          const handleKeyDown = (e: KeyboardEvent) => {
            handleDateInput(e as unknown as React.KeyboardEvent<HTMLInputElement>);
          };

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

  const handleChange: AntDatePickerProps['onChange'] = (date, dateString) => {
    if (onChange) {
      onChange(date, dateString);
    }
  };

  return (
    <ConfigProvider locale={ruRU}>
      <div ref={containerRef}>
        <AntDatePicker
          className={className || 'date-picker'}
          format={format || 'DD.MM.YYYY'}
          inputReadOnly={inputReadOnly ?? false}
          onChange={handleChange}
          superNextIcon={disableYearNavigation ? null : undefined}
          superPrevIcon={disableYearNavigation ? null : undefined}
          {...restProps}
        />
      </div>
    </ConfigProvider>
  );
};

const RangePicker: React.FC<RangePickerProps> = ({
  format,
  inputReadOnly,
  onChange,
  className,
  ...restProps
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const findAndAttachMask = () => {
      if (containerRef.current) {
        const inputs = containerRef.current.querySelectorAll('input');

        if (inputs.length > 0) {
          const handleKeyDown = (e: KeyboardEvent) => {
            handleDateInput(e as unknown as React.KeyboardEvent<HTMLInputElement>);
          };

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

  const handleChange: React.ComponentProps<typeof AntRangePicker>['onChange'] = (
    dates,
    dateStrings
  ) => {
    if (onChange) {
      onChange(dates, dateStrings);
    }
  };

  const presets = getDateRangePresets().map(preset => ({
    label: preset.label,
    value: preset.value,
  }));

  return (
    <ConfigProvider locale={ruRU}>
      <div ref={containerRef}>
        <AntRangePicker
          className={className || 'date-range-picker'}
          format={format || 'DD.MM.YYYY'}
          inputReadOnly={inputReadOnly ?? false}
          onChange={handleChange}
          presets={presets}
          {...restProps}
        />
      </div>
    </ConfigProvider>
  );
};

export default DatePicker;
export { RangePicker };
