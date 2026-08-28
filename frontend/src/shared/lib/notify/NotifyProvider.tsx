import { App } from 'antd';
import { bindNotifyMessageApi } from './notify';
import type { ReactNode } from 'react';

/** Связать notify с message из AntApp (theme/context), по документации antd App.useApp. */
export const NotifyProvider = ({ children }: { children: ReactNode }) => {
  const { message } = App.useApp();
  // Синхронно: иначе дочерние эффекты успеют вызвать notify до bind
  bindNotifyMessageApi(message);
  return children;
};
