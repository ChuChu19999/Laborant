import React from 'react';
import './SplitPanel.css';

interface SplitPanelProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  className?: string;
  /** Скрыть левую панель и растянуть правую (режим редактирования расчёта). */
  hideLeft?: boolean;
}

const SplitPanel = ({ leftPanel, rightPanel, className, hideLeft = false }: SplitPanelProps) => {
  return (
    <div
      className={['split-panel', hideLeft ? 'split-panel--hide-left' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="split-panel-left">{leftPanel}</div>
      <div className="split-panel-right">{rightPanel}</div>
    </div>
  );
};

export default SplitPanel;
