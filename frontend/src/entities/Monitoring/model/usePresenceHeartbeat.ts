import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { monitoringApi, monitoringKeys } from '../api';

const HEARTBEAT_INTERVAL_MS = 45_000;

/** Периодически отправляет heartbeat присутствия и при смене маршрута. */
export const usePresenceHeartbeat = (enabled: boolean, currentPath: string) => {
  const enabledRef = useRef(enabled);
  const queryClient = useQueryClient();
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const sendHeartbeat = () => {
      if (!enabledRef.current) {
        return;
      }
      void monitoringApi
        .sendHeartbeat({ current_path: currentPath })
        .then(() =>
          queryClient.invalidateQueries({
            queryKey: monitoringKeys.overviews(),
          })
        )
        .catch(() => undefined);
    };

    sendHeartbeat();
    const timerId = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, [enabled, currentPath, queryClient]);
};
