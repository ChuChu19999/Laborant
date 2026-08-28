import { useEffect, useState } from 'react';
import { loadMainLoadingAnimation } from '@/shared/assets';
import { LottieAnimation } from '@/shared/ui/LottieAnimation';
import './LoadingPage.css';

const MIN_LOADING_TIME = 2000;

interface LoadingPageProps {
  isLoading: boolean;
  onFadeOutComplete?: () => void;
}

const LoadingPage = ({ isLoading, onFadeOutComplete }: LoadingPageProps) => {
  const [shouldShow, setShouldShow] = useState(true);

  useEffect(() => {
    if (isLoading) {
      setShouldShow(true);
      return;
    }

    const startTime = Date.now();
    const remainingTime = Math.max(0, MIN_LOADING_TIME - (Date.now() - startTime));

    const timer = setTimeout(() => {
      setShouldShow(false);
      if (onFadeOutComplete) {
        setTimeout(onFadeOutComplete, 300);
      }
    }, remainingTime);

    return () => clearTimeout(timer);
  }, [isLoading, onFadeOutComplete]);

  return (
    <div className={`loading-page-wrapper ${shouldShow ? 'loading' : 'hidden'}`}>
      <LottieAnimation loadAnimation={loadMainLoadingAnimation} />
    </div>
  );
};

export default LoadingPage;
