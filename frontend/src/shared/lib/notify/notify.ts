import type { MessageInstance } from 'antd/es/message/interface';

type NotifyMessageApi = Pick<MessageInstance, 'success' | 'error' | 'warning' | 'info'>;

let messageApi: NotifyMessageApi | null = null;

/** Подключить instance из App.useApp() — иначе static message не видит theme/context. */
export const bindNotifyMessageApi = (api: NotifyMessageApi) => {
  messageApi = api;
};

/** Тосты уведомлений приложения. */
export const notify = {
  success: (content: string) => {
    messageApi?.success(content);
  },
  error: (content: string) => {
    messageApi?.error(content);
  },
  warning: (content: string) => {
    messageApi?.warning(content);
  },
  info: (content: string) => {
    messageApi?.info(content);
  },
};
