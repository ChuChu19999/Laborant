import { ConfigProvider } from 'antd';
import type { ReactNode } from 'react';

interface AntdWavelessProviderProps {
  children: ReactNode;
}

/** Локальный ConfigProvider: отключает ripple wave у antd (toolbar ExcelEditor и аналоги). */
export function AntdWavelessProvider({ children }: AntdWavelessProviderProps) {
  return <ConfigProvider wave={{ disabled: true }}>{children}</ConfigProvider>;
}
