import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseCircleFilled } from '@ant-design/icons';
import { message, Spin } from 'antd';
import { samplesApi } from '../../../shared/api/samples';
import { Input } from '../../../shared/ui/FormItems';
import './RegistrationNumberPicker.css';

interface SampleBrief {
  id: number;
  registration_number: string;
  test_object: string;
}

interface RegistrationNumberPickerProps {
  value: string;
  onChange: (val: string) => void;
  laboratoryId?: number;
  departmentId?: number;
  methodId?: number | null;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  error?: string;
}

const RegistrationNumberPicker: React.FC<RegistrationNumberPickerProps> = ({
  value,
  onChange,
  laboratoryId,
  departmentId,
  methodId,
  placeholder = 'Введите регистрационный номер пробы',
  disabled = false,
  className = '',
  style,
  error,
}) => {
  const [searchText, setSearchText] = useState('');
  const [options, setOptions] = useState<SampleBrief[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

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
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setOptions([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const performSearch = useCallback(
    async (text: string) => {
      if (!laboratoryId || !methodId || !text || text.length < 1) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        const resp = await samplesApi.getRegistrationNumbers(
          laboratoryId,
          departmentId,
          methodId,
          text
        );
        setOptions(resp.samples ? resp.samples.slice(0, 10) : []);
      } catch (err) {
        console.error('Ошибка поиска номеров проб:', err);
        message.error('Не удалось загрузить номера проб');
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [laboratoryId, departmentId, methodId]
  );

  const handleSearch = useCallback(
    (text: string) => {
      setSearchText(text);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      if (!text || text.trim().length < 1) {
        setOptions([]);
        return;
      }
      debounceTimer.current = setTimeout(() => performSearch(text), 300);
    },
    [performSearch]
  );

  const handleSelect = (sample: SampleBrief) => {
    setSearchText(sample.registration_number);
    setOptions([]);
    onChange(sample.registration_number);
  };

  const handleClear = () => {
    setSearchText('');
    setOptions([]);
    onChange('');
  };

  const dropdown =
    options.length > 0 && !disabled && !value
      ? createPortal(
          <div
            ref={dropdownRef}
            className="reg-number-picker-dropdown"
            style={
              {
                '--dropdown-top': `${dropdownPos.top}px`,
                '--dropdown-left': `${dropdownPos.left}px`,
                '--dropdown-width': `${dropdownPos.width}px`,
              } as React.CSSProperties
            }
          >
            {loading ? (
              <div className="reg-number-picker-loading">
                <Spin size="small" />
              </div>
            ) : (
              options.map(opt => (
                <div
                  key={opt.id}
                  className="reg-number-picker-option"
                  onClick={() => handleSelect(opt)}
                >
                  <span style={{ fontWeight: 500 }}>{opt.registration_number}</span>
                  <span style={{ color: '#666', marginLeft: 8, fontSize: 13 }}>
                    {opt.test_object}
                  </span>
                </div>
              ))
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={containerRef} className={`reg-number-picker-container ${className}`} style={style}>
      <div ref={inputRef}>
        <Input
          value={searchText}
          placeholder={placeholder}
          disabled={disabled}
          onChange={e => handleSearch(e.target.value)}
          suffix={
            !disabled && searchText ? (
              <CloseCircleFilled onClick={handleClear} />
            ) : (
              <span style={{ width: 16, display: 'inline-block' }} />
            )
          }
          className={error ? 'reg-number-input-error' : ''}
        />
      </div>
      {error && <div className="reg-number-picker-error">{error}</div>}
      {dropdown}
    </div>
  );
};

export default RegistrationNumberPicker;
