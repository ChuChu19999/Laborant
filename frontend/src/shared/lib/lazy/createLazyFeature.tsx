import { lazy, Suspense, type ComponentType } from 'react';
import FeatureFallback from './FeatureFallback';

export function createLazyFeature<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>
): ComponentType<P> {
  const LazyComponent = lazy(loader);

  const Wrapped = (props: P) => (
    <Suspense fallback={<FeatureFallback />}>
      <LazyComponent {...props} />
    </Suspense>
  );

  return Wrapped;
}
