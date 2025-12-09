import React from 'react';
import './SplitPanel.css';

interface SplitPanelProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
}

const SplitPanel: React.FC<SplitPanelProps> = ({ leftPanel, rightPanel }) => {
  return (
    <div className="split-panel">
      <div className="split-panel-left">{leftPanel}</div>
      <div className="split-panel-right">{rightPanel}</div>
    </div>
  );
};

export default SplitPanel;
