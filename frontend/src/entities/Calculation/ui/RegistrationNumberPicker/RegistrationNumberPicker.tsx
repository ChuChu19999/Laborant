import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { notify } from '@/shared/lib/notify';
import { Input } from '@/shared/ui/FormItems';
import { Spin } from '@/shared/ui/Spin';
import { useRegistrationNumberSearch } from '../../model/useRegistrationNumberSearch';
import './RegistrationNumberPicker.css';

interface RegistrationNumberPickerProps {
  value: string;
  onChange: (val: string) => void;
  laboratoryId?: number;
  departmentId?: number;
  methodId?: number | null;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
}

const RegistrationNumberPicker = ({
  value,
  onChange,
  laboratoryId,
  departmentId,
  methodId,
  placeholder = 'Введите регистрационный номер пробы',
  disabled = false,
  className = '',
  error,
}: RegistrationNumberPickerProps) => {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const canSearch = !disabled && !value && debouncedSearch.trim().length >= 1;
  const { data, isFetching, isError } = useRegistrationNumberSearch(
    debouncedSearch,
    laboratoryId,
    departmentId,
    methodId,
    canSearch
  );

  const options = canSearch ? (data?.samples ?? []) : [];

  useEffect(() => {
    if (isError) {
      notify.error('Не удалось загрузить номера проб');
    }
  }, [isError]);

  useEffect(() => {
    if (value) {
      setSearchText(value);
    } else {
      setSearchText('');
    }
  }, [value]);

  const updatePos = useCallback(() => {
    if (inputRef.current && options.length) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, [options.length]);

  useEffect(() => {
    if (options.length > 0) {
      updatePos();
      window.addEventListener('scroll', updatePos, true);
      window.addEventListener('resize', updatePos);
      return () => {
        window.removeEventListener('scroll', updatePos, true);
        window.removeEventListener('resize', updatePos);
      };
    }
  }, [options.length, updatePos]);

  useEffect(() => {
    const el = dropdownRef.current;
    if (!el || options.length === 0) return;
    el.style.setProperty('--dropdown-top', `${dropdownPos.top}px`);
    el.style.setProperty('--dropdown-left', `${dropdownPos.left}px`);
    el.style.setProperty('--dropdown-width', `${dropdownPos.width}px`);
  }, [dropdownPos, options.length]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setDebouncedSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!text || text.trim().length < 1) {
      setDebouncedSearch('');
      return;
    }

    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(text);
    }, 300);
  }, []);

  const handleSelect = (sample: { registration_number: string }) => {
    setSearchText(sample.registration_number);
    setDebouncedSearch('');
    onChange(sample.registration_number);
  };

  const handleClear = () => {
    setSearchText('');
    setDebouncedSearch('');
    onChange('');
  };

  const dropdown =
    options.length > 0 && !disabled && !value
      ? createPortal(
          <div
            ref={dropdownRef}
            className="reg-number-picker-dropdown"
            role="listbox"
            aria-label="Список регистрационных номеров"
          >
            {isFetching ? (
              <div className="reg-number-picker-loading">
                <Spin size="small" />
              </div>
            ) : (
              options.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  className="reg-number-picker-option"
                  onClick={() => handleSelect(opt)}
                >
                  <span className="reg-number-picker-option-number">{opt.registration_number}</span>
                  <span className="reg-number-picker-option-object">{opt.test_object}</span>
                </button>
              ))
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={containerRef} className={`reg-number-picker-container ${className}`}>
      <div ref={inputRef}>
        <Input
          value={searchText}
          placeholder={placeholder}
          disabled={disabled}
          allowClear={!disabled}
          onChange={e => handleSearch(e.target.value)}
          onClear={handleClear}
          className={error ? 'reg-number-input-error' : ''}
        />
      </div>
      {error && <div className="reg-number-picker-error">{error}</div>}
      {dropdown}
    </div>
  );
};

export default RegistrationNumberPicker;
