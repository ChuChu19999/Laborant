import React from 'react';
import { Button, Select } from 'antd';
import { Checkbox } from '@/shared/ui/Checkbox';
import {
  getFilterSelectWidthStyle,
  getLongestLabelWidth,
  type FilterSelectExpandDirection,
} from './filterSelectLayout';
import type { TableFilterSelectPopupApi } from '@/shared/ui/TableFilter/useTableFilterSelectPopup';
import type { SelectProps } from 'antd';
import './MultiSelectColumnFilter.css';

export type MultiSelectColumnFilterOption = {
  label: React.ReactNode;
  value: string;
};

export type MultiSelectColumnFilterProps = {
  value: string[];
  onApply: (value: string[]) => void;
  options: MultiSelectColumnFilterOption[];
  placeholder?: string;
  className?: string;
  showCheckbox?: boolean;
  showSearch?: boolean;
  filterOption?: SelectProps['filterOption'];
  columnWidth?: number;
  neighborWidth?: number;
  expandDirection?: FilterSelectExpandDirection;
  selectPopup?: TableFilterSelectPopupApi;
  popupMatchSelectWidth?: false;
  styles?: SelectProps['styles'];
  classNames?: SelectProps['classNames'];
};

function optionLabelToString(label: React.ReactNode, fallback: string): string {
  if (typeof label === 'string' || typeof label === 'number') {
    return String(label);
  }
  return fallback;
}

/** Мультиселект фильтра колонки таблицы с черновиком и кнопками «Ок» / «Отмена». */
const MultiSelectColumnFilter = ({
  value,
  onApply,
  options,
  placeholder,
  className,
  showCheckbox = true,
  showSearch = false,
  filterOption,
  columnWidth,
  neighborWidth,
  expandDirection = 'right',
  selectPopup,
  popupMatchSelectWidth = false,
  styles,
  classNames,
}: MultiSelectColumnFilterProps) => {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<string[]>(value);
  const draftRef = React.useRef(draft);
  const closeActionRef = React.useRef<'ok' | 'cancel' | null>(null);

  const commitDraft = React.useCallback((next: string[]) => {
    setDraft(next);
    draftRef.current = next;
  }, []);

  React.useEffect(() => {
    if (!open) {
      commitDraft(value);
    }
  }, [value, open, commitDraft]);

  const contentWidth = React.useMemo(() => {
    const labels = options.map(opt => optionLabelToString(opt.label, opt.value));
    return getLongestLabelWidth(labels, placeholder);
  }, [options, placeholder]);

  const widthStyle = React.useMemo(() => {
    if (selectPopup != null || columnWidth == null || neighborWidth == null) {
      return { width: '100%' as const };
    }
    return getFilterSelectWidthStyle({
      columnWidth,
      neighborWidth,
      expandDirection,
      contentWidth,
    });
  }, [selectPopup, columnWidth, neighborWidth, expandDirection, contentWidth]);

  const notifyOpenChange = React.useMemo(() => selectPopup?.wrapOpenChange(), [selectPopup]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      commitDraft(value);
      closeActionRef.current = null;
      setOpen(true);
      notifyOpenChange?.(true);
      return;
    }

    const action = closeActionRef.current;
    closeActionRef.current = null;

    if (action === 'cancel') {
      commitDraft(value);
    } else if (action !== 'ok') {
      onApply(draftRef.current);
    }

    setOpen(false);
    notifyOpenChange?.(false);
  };

  const handleOk = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeActionRef.current = 'ok';
    onApply(draftRef.current);
    setOpen(false);
    notifyOpenChange?.(false);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeActionRef.current = 'cancel';
    commitDraft(value);
    setOpen(false);
    notifyOpenChange?.(false);
  };

  const rootClassName = [
    'form-item-control',
    'multi-select-column-filter',
    open ? 'multi-select-column-filter--open' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  const mergedClassNames: SelectProps['classNames'] = {
    ...classNames,
    popup: {
      ...classNames?.popup,
      root: ['multi-select-column-filter-dropdown', classNames?.popup?.root]
        .filter(Boolean)
        .join(' '),
    },
  };

  return (
    <Select
      mode="multiple"
      open={open}
      value={open ? draft : value}
      onOpenChange={handleOpenChange}
      onChange={(next: string[]) => {
        commitDraft(next);
        if (!open) {
          onApply(next);
        }
      }}
      allowClear
      onClear={() => {
        commitDraft([]);
        onApply([]);
      }}
      placeholder={placeholder}
      className={rootClassName}
      classNames={mergedClassNames}
      styles={styles}
      popupMatchSelectWidth={popupMatchSelectWidth}
      virtual={false}
      showSearch={showSearch}
      filterOption={filterOption}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      options={options}
      optionRender={
        showCheckbox
          ? option => {
              const optionValue = String(option.value);
              const isSelected = draft.includes(optionValue);
              return (
                <div className="multi-select-column-filter-option">
                  <Checkbox
                    checked={isSelected}
                    onClick={e => {
                      e.stopPropagation();
                      const next = isSelected
                        ? draft.filter(item => item !== optionValue)
                        : [...draft, optionValue];
                      commitDraft(next);
                    }}
                  />
                  <span className="multi-select-column-filter-option-label">{option.label}</span>
                </div>
              );
            }
          : undefined
      }
      popupRender={menu => (
        <>
          {menu}
          <div className="multi-select-column-filter-footer" onMouseDown={e => e.preventDefault()}>
            <Button size="small" onClick={handleCancel}>
              Отмена
            </Button>
            <Button size="small" type="primary" onClick={handleOk}>
              Ок
            </Button>
          </div>
        </>
      )}
      style={widthStyle}
    />
  );
};

export default MultiSelectColumnFilter;
