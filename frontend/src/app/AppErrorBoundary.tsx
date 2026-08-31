import { reportMonitoringClientError } from '@/entities/Monitoring';
import { loadMainLoadingAnimation } from '@/shared/assets';
import { ErrorCard } from '@/shared/ui/ErrorCard';
import { ReactErrorBoundary } from '@/shared/ui/ReactErrorBoundary';
import type { ErrorInfo, ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

const handleRenderError = (error: Error, errorInfo: ErrorInfo) => {
  const stack = [error.stack, errorInfo.componentStack].filter(Boolean).join('\n');
  reportMonitoringClientError('critical', error.message, stack);
};

/** Перехватывает ошибки рендера и отправляет их в мониторинг. */
export const AppErrorBoundary = ({ children }: AppErrorBoundaryProps) => {
  return (
    <ReactErrorBoundary
      onError={handleRenderError}
      fallback={
        <ErrorCard
          title="Ошибка интерфейса"
          text="Произошла ошибка отображения страницы. Обновите страницу."
          loadAnimation={loadMainLoadingAnimation}
        />
      }
    >
      {children}
    </ReactErrorBoundary>
  );
};
