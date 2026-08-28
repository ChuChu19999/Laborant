import { ConfigProvider } from 'antd';
import { TABLE_CONTROL_THEME } from './tableControlTheme';
import type { ReactNode } from 'react';
import './TableFilter.css';

interface TableFilterThemeProps {
  children: ReactNode;
}

/** Обёртка фильтров таблицы: вид через theme ConfigProvider, без `.ant-*` в CSS. */
export function TableFilterTheme({ children }: TableFilterThemeProps) {
  return <ConfigProvider theme={TABLE_CONTROL_THEME}>{children}</ConfigProvider>;
}
