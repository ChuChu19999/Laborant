import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ReactErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ReactErrorBoundaryState {
  hasError: boolean;
}

/** Классовая обёртка для перехвата ошибок рендера (ограничение API React). */
export class ReactErrorBoundary extends Component<
  ReactErrorBoundaryProps,
  ReactErrorBoundaryState
> {
  state: ReactErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ReactErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}
