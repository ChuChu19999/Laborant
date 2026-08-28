import type { TableFilterSelectPopupApi } from './useTableFilterSelectPopup';

export function tableFilterSelectProps(
  selectPopup: TableFilterSelectPopupApi,
  onOpenChange?: (open: boolean) => void
) {
  return {
    popupMatchSelectWidth: selectPopup.popupMatchSelectWidth,
    styles: selectPopup.styles,
    classNames: selectPopup.classNames,
    onOpenChange: selectPopup.wrapOpenChange(onOpenChange),
  };
}
