import { useLocation } from 'react-router-dom';
import { usePresenceHeartbeat } from '@/entities/Monitoring';

type PresenceHeartbeatProps = {
  enabled: boolean;
};

/** Heartbeat присутствия внутри Router — путь обновляется при навигации. */
export const PresenceHeartbeat = ({ enabled }: PresenceHeartbeatProps) => {
  const location = useLocation();
  usePresenceHeartbeat(enabled, location.pathname);
  return null;
};
