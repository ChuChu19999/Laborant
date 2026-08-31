import { useState } from 'react';

/** Состояние модалок панели мониторинга. */
export const useMonitoringPanelModals = () => {
  const [selectedErrorId, setSelectedErrorId] = useState<number | null>(null);
  const [statusAction, setStatusAction] = useState<{ errorId: number; resolved: boolean } | null>(
    null
  );
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false);

  const openDetails = (errorId: number) => {
    setSelectedErrorId(errorId);
  };

  const closeDetails = () => {
    setSelectedErrorId(null);
  };

  const requestStatusChange = (errorId: number, resolved: boolean) => {
    setStatusAction({ errorId, resolved });
  };

  const cancelStatusChange = () => {
    setStatusAction(null);
  };

  const handleCleanupClosed = () => {
    setCleanupConfirmOpen(true);
  };

  const cancelCleanupClosed = () => {
    setCleanupConfirmOpen(false);
  };

  return {
    selectedErrorId,
    statusAction,
    cleanupConfirmOpen,
    openDetails,
    closeDetails,
    requestStatusChange,
    cancelStatusChange,
    handleCleanupClosed,
    cancelCleanupClosed,
    setCleanupConfirmOpen,
    setStatusAction,
  };
};
