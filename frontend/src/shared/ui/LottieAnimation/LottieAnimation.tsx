import { useEffect, useState, type ComponentType } from 'react';
import { Spin } from '@/shared/ui/Spin';
import './LottieAnimation.css';

type LottieComponent = ComponentType<{
  animationData: object;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
}>;

interface LottieAnimationProps {
  loadAnimation: () => Promise<{ default: object }>;
  className?: string;
  loop?: boolean;
}

const LottieAnimation = ({ loadAnimation, className, loop = true }: LottieAnimationProps) => {
  const [ready, setReady] = useState<{
    Lottie: LottieComponent;
    animationData: object;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([import('lottie-react'), loadAnimation()]).then(
      ([lottieModule, animationModule]) => {
        if (cancelled) {
          return;
        }

        setReady({
          Lottie: lottieModule.default,
          animationData: animationModule.default,
        });
      }
    );

    return () => {
      cancelled = true;
    };
  }, [loadAnimation]);

  if (!ready) {
    return (
      <div className={`lottie-animation-fallback ${className ?? ''}`}>
        <Spin />
      </div>
    );
  }

  const { Lottie, animationData } = ready;

  return <Lottie animationData={animationData} loop={loop} autoplay className={className} />;
};

export default LottieAnimation;
