import { useEffect, useRef, useState } from 'react';
import { Spin } from 'antd';
import './LoadingCard.css';

interface LoadingCardProps {
  loading?: boolean;
  minDuration?: number; // Минимальная длительность показа в миллисекундах (по умолчанию 500)
}

const LoadingCard = ({ loading = true, minDuration = 500 }: LoadingCardProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const prevLoadingRef = useRef<boolean | undefined>(undefined);
  const startTimeRef = useRef<number | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [internalLoading, setInternalLoading] = useState(loading);

  // Управление показом загрузчика с минимальной длительностью
  useEffect(() => {
    const wasFalse = prevLoadingRef.current === false;

    if (loading) {
      // Запоминаем время начала загрузки (только при переходе из false в true)
      if (wasFalse || startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }
      setInternalLoading(true);
    } else {
      // Когда loading становится false, проверяем минимальную длительность
      if (startTimeRef.current !== null) {
        const elapsedTime = Date.now() - startTimeRef.current;
        if (elapsedTime < minDuration) {
          // Если прошло меньше минимального времени, ждем оставшееся время
          const remainingTime = minDuration - elapsedTime;
          const timer = setTimeout(() => {
            setInternalLoading(false);
            startTimeRef.current = null;
          }, remainingTime);
          prevLoadingRef.current = loading;
          return () => clearTimeout(timer);
        } else {
          // Если прошло достаточно времени, сразу скрываем
          setInternalLoading(false);
          startTimeRef.current = null;
        }
      } else {
        setInternalLoading(false);
      }
    }
    prevLoadingRef.current = loading;
  }, [loading, minDuration]);

  useEffect(() => {
    const contentElement = wrapperRef.current?.closest('.layout-wrapper .content') as HTMLElement;
    if (!contentElement) return;

    const updatePosition = () => {
      const rect = contentElement.getBoundingClientRect();
      setPosition({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    if (internalLoading) {
      updatePosition();

      // Блокируем скролл и скрываем скроллбар
      contentElement.classList.add('loading-active');
      const scrollTop = contentElement.scrollTop;

      const preventScroll = (e: WheelEvent | TouchEvent) => {
        e.preventDefault();
      };

      const resetScroll = () => {
        contentElement.scrollTop = scrollTop;
      };

      const handleResize = () => {
        updatePosition();
      };

      contentElement.addEventListener('wheel', preventScroll, { passive: false });
      contentElement.addEventListener('touchmove', preventScroll, { passive: false });
      contentElement.addEventListener('scroll', resetScroll);
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', updatePosition, true);

      return () => {
        contentElement.removeEventListener('wheel', preventScroll);
        contentElement.removeEventListener('touchmove', preventScroll);
        contentElement.removeEventListener('scroll', resetScroll);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', updatePosition, true);
        contentElement.classList.remove('loading-active');
      };
    } else {
      contentElement.classList.remove('loading-active');
    }
  }, [internalLoading]);

  if (!internalLoading) return null;

  return (
    <div
      ref={wrapperRef}
      className="loading-card-wrapper"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
        height: `${position.height}px`,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <Spin size="large" spinning={true} />
      </div>
    </div>
  );
};

export default LoadingCard;
