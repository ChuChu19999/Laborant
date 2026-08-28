import type { ThemeConfig } from 'antd';

/** Тема полей фильтров таблицы и page-size — те же токены, что у форм в модалках (App ConfigProvider). */
export const TABLE_CONTROL_THEME: ThemeConfig = {
  token: {
    fontFamily: 'HeliosCondC, sans-serif',
    colorBorder: '#d9d9d9',
    borderRadius: 8,
    fontSize: 14,
    colorPrimary: '#1677ff',
    controlHeight: 32,
    controlOutline: 'rgba(22, 119, 255, 0.1)',
  },
  components: {
    Input: {
      fontSize: 14,
      borderRadius: 8,
      hoverBorderColor: '#1677ff',
      activeBorderColor: '#1677ff',
      activeShadow: '0 0 0 2px rgba(22, 119, 255, 0.1)',
    },
    Select: {
      fontSize: 14,
      optionFontSize: 14,
      optionPadding: '6px 12px',
      borderRadius: 8,
      hoverBorderColor: '#1677ff',
      activeBorderColor: '#1677ff',
    },
    DatePicker: {
      fontSize: 14,
      borderRadius: 8,
      hoverBorderColor: '#1677ff',
      activeBorderColor: '#1677ff',
      activeShadow: '0 0 0 2px rgba(22, 119, 255, 0.1)',
    },
  },
};
