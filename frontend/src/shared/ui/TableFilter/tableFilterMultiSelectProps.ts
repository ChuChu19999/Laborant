import type { TableFilterSelectPopupApi } from './useTableFilterSelectPopup';

export function tableFilterMultiSelectProps(selectPopup: TableFilterSelectPopupApi) {
  return {
    selectPopup,
    popupMatchSelectWidth: selectPopup.popupMatchSelectWidth,
    styles: selectPopup.styles,
    classNames: {
      popup: {
        root: `table-filter-select-dropdown ${selectPopup.classNames.popup.root}`,
      },
    },
  };
}
