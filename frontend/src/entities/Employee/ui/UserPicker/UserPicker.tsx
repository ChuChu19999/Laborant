import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { notify } from '@/shared/lib/notify';
import { Input } from '@/shared/ui/FormItems';
import { Spin } from '@/shared/ui/Spin';
import { useEmployeeSearch } from '../../model/useEmployees';
import type { Employee, EmployeePhoto } from '../../api';
import './UserPicker.css';

interface UserPickerProps {
  value?: Employee | null;
  onChange?: (employee: Employee | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  laboratoryName?: string;
  allowClear?: boolean;
  id?: string;
}

const UserPicker = ({
  value,
  onChange,
  placeholder = 'Введите ФИО сотрудника',
  disabled = false,
  className = '',
  error,
  laboratoryName,
  allowClear = true,
  id,
}: UserPickerProps) => {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  const canSearch = !value && debouncedSearch.length >= 3;
  const {
    data: searchResults = [],
    isFetching,
    isError,
  } = useEmployeeSearch(debouncedSearch, laboratoryName, canSearch);

  const options = canSearch ? searchResults : [];

  useEffect(() => {
    if (isError) {
      notify.error('Не удалось загрузить список сотрудников');
    }
  }, [isError]);

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
    const el = dropdownRef.current;
    if (!el || options.length === 0) return;
    el.style.setProperty('--dropdown-top', `${dropdownPosition.top}px`);
    el.style.setProperty('--dropdown-left', `${dropdownPosition.left}px`);
    el.style.setProperty('--dropdown-width', `${dropdownPosition.width}px`);
  }, [dropdownPosition, options.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setDebouncedSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleSearch = useCallback(
    (text: string) => {
      setSearchText(text);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (!text || text.length < 3) {
        setDebouncedSearch('');
        if (onChange && text.length === 0) {
          onChange(null);
        }
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        setDebouncedSearch(text);
      }, 300);
    },
    [onChange]
  );

  const handleSelect = (employee: Employee) => {
    setSearchText(employee.fullName);
    setDebouncedSearch('');
    if (onChange) {
      onChange(employee);
    }
  };

  const handleClear = () => {
    setSearchText('');
    setDebouncedSearch('');
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
        role="listbox"
        aria-label="Список сотрудников"
      >
        <Spin spinning={isFetching} size="small" />
        {!isFetching &&
          options.map(emp => {
            const photoUrl = getPhotoUrl(emp.employeePhoto);
            return (
              <button
                key={emp.hsnils}
                type="button"
                role="option"
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
              </button>
            );
          })}
      </div>
    );

    return createPortal(dropdownContent, document.body);
  };

  return (
    <div ref={containerRef} className={`user-picker-container ${className}`}>
      <div ref={inputRef}>
        <Input
          id={id}
          value={searchText}
          placeholder={placeholder}
          disabled={disabled}
          allowClear={allowClear && !disabled}
          onChange={e => handleSearch(e.target.value)}
          onClear={handleClear}
          className={error ? 'user-picker-input-error' : ''}
        />
      </div>
      {error && <div className="user-picker-error">{error}</div>}
      {renderDropdown()}
    </div>
  );
};

export default UserPicker;
