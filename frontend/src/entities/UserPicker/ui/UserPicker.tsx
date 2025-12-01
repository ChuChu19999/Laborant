import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CloseCircleFilled } from '@ant-design/icons';
import { Input, message } from 'antd';
import { LoadingCard } from '../../../features/Cards';
import { employeesApi } from '../../../shared/api/employees';
import './UserPicker.css';

export interface EmployeePhoto {
  photoWebp50?: string | null;
  photoWebp50sha256?: string;
  photoWebp300?: string | null;
  photoJpg300sha256?: string;
  photoWebp200?: string | null;
  photoWebp200Sha256?: string;
}

export interface Employee {
  hashMd5: string;
  fullName: string;
  employeePhoto?: EmployeePhoto | null;
  jobTitle?: string;
  [key: string]: unknown;
}

interface UserPickerProps {
  value?: Employee | null;
  onChange?: (employee: Employee | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  error?: string;
}

const UserPicker: React.FC<UserPickerProps> = ({
  value,
  onChange,
  placeholder = 'Введите ФИО сотрудника',
  disabled = false,
  className = '',
  style,
  error,
}) => {
  const [searchText, setSearchText] = useState('');
  const [options, setOptions] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (value) {
      setSearchText(value.fullName || '');
    } else {
      setSearchText('');
    }
  }, [value]);

  useEffect(() => {
    const updatePosition = () => {
      if (inputRef.current && options.length > 0) {
        const rect = inputRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        });
      }
    };

    if (options.length > 0) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [options.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setOptions([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      // Очищаем таймер при размонтировании компонента
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const performSearch = useCallback(
    async (text: string) => {
      if (!text || text.length < 3) {
        setOptions([]);
        if (onChange && text.length === 0) {
          onChange(null);
        }
        return;
      }

      setLoading(true);
      try {
        const data = await employeesApi.searchByFio(text, true);
        setOptions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Ошибка при поиске сотрудников:', err);
        message.error('Не удалось загрузить список сотрудников');
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [onChange]
  );

  const handleSearch = useCallback(
    (text: string) => {
      setSearchText(text);

      // Очищаем предыдущий таймер
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (!text || text.length < 3) {
        setOptions([]);
        if (onChange && text.length === 0) {
          onChange(null);
        }
        return;
      }

      // Дебаунсинг: ждем 300ms после последнего ввода перед отправкой запроса
      debounceTimerRef.current = setTimeout(() => {
        performSearch(text);
      }, 300);
    },
    [onChange, performSearch]
  );

  const handleSelect = (employee: Employee) => {
    setSearchText(employee.fullName);
    setOptions([]);
    if (onChange) {
      onChange(employee);
    }
  };

  const handleClear = () => {
    setSearchText('');
    setOptions([]);
    if (onChange) {
      onChange(null);
    }
  };

  const formatPhotoUrl = (photoString: string): string => {
    if (!photoString || !photoString.trim()) return '';

    const trimmed = photoString.trim();

    if (trimmed.startsWith('data:')) {
      return trimmed;
    }

    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('//')
    ) {
      return trimmed;
    }

    try {
      new URL(trimmed);
      return trimmed;
    } catch {
      return `data:image/webp;base64,${trimmed}`;
    }
  };

  const getPhotoUrl = (photo: EmployeePhoto | null | undefined): string => {
    if (!photo) return '';
    if (photo.photoWebp50) {
      const url = formatPhotoUrl(photo.photoWebp50);
      if (url) return url;
    }
    if (photo.photoWebp200) {
      const url = formatPhotoUrl(photo.photoWebp200);
      if (url) return url;
    }
    if (photo.photoWebp300) {
      const url = formatPhotoUrl(photo.photoWebp300);
      if (url) return url;
    }
    // Если нет ни одного фото, возвращаем пустую строку для показа placeholder
    return '';
  };

  const getFallbackPhotoUrl = (
    photo: EmployeePhoto | null | undefined,
    currentUrl: string
  ): string | null => {
    if (!photo) return null;
    const formatted200 = photo.photoWebp200 ? formatPhotoUrl(photo.photoWebp200) : '';
    const formatted50 = photo.photoWebp50 ? formatPhotoUrl(photo.photoWebp50) : '';
    const formatted300 = photo.photoWebp300 ? formatPhotoUrl(photo.photoWebp300) : '';

    if (currentUrl === formatted200) {
      if (formatted50) return formatted50;
      if (formatted300) return formatted300;
    }
    if (currentUrl === formatted50 && formatted300) {
      return formatted300;
    }
    if (currentUrl === formatted300 && formatted50) {
      return formatted50;
    }
    return null;
  };

  const handleImageError = (
    e: React.SyntheticEvent<HTMLImageElement, Event>,
    photo: EmployeePhoto | null | undefined
  ) => {
    const img = e.currentTarget;
    const fallbackUrl = getFallbackPhotoUrl(photo, img.src);
    if (fallbackUrl) {
      img.src = fallbackUrl;
    } else {
      img.style.display = 'none';
      const placeholder = document.createElement('div');
      placeholder.className = 'user-picker-option-photo-placeholder';
      placeholder.textContent = (img.alt || '?').charAt(0).toUpperCase();
      img.parentNode?.insertBefore(placeholder, img);
    }
  };

  const renderDropdown = () => {
    if (options.length === 0 || value) return null;

    const dropdownContent = (
      <div
        ref={dropdownRef}
        className="user-picker-dropdown"
        style={{
          position: 'absolute',
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
          width: `${dropdownPosition.width}px`,
        }}
      >
        <LoadingCard loading={loading} />
        {!loading &&
          options.map(emp => {
            const photoUrl = getPhotoUrl(emp.employeePhoto);
            return (
              <div
                key={emp.hashMd5}
                className="user-picker-option"
                onClick={() => handleSelect(emp)}
              >
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={emp.fullName}
                    className="user-picker-option-photo"
                    onError={e => handleImageError(e, emp.employeePhoto)}
                    loading="lazy"
                  />
                ) : (
                  <div className="user-picker-option-photo-placeholder">
                    {emp.fullName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="user-picker-option-content">
                  <span className="user-picker-option-name">{emp.fullName}</span>
                  {emp.jobTitle && (
                    <span className="user-picker-option-job-title">{emp.jobTitle}</span>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    );

    return createPortal(dropdownContent, document.body);
  };

  return (
    <div ref={containerRef} className={`user-picker-container ${className}`} style={style}>
      <div ref={inputRef}>
        <Input
          value={searchText}
          placeholder={placeholder}
          disabled={disabled}
          onChange={e => handleSearch(e.target.value)}
          suffix={
            value ? (
              <CloseCircleFilled className="user-picker-clear-icon" onClick={handleClear} />
            ) : null
          }
          className={error ? 'user-picker-input-error' : ''}
        />
      </div>
      {error && <div className="user-picker-error">{error}</div>}
      {renderDropdown()}
    </div>
  );
};

export default UserPicker;
