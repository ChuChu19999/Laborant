import React from 'react';
import './ThreePanel.css';

interface ThreePanelProps {
  leftPanel: React.ReactNode;
  middlePanel: React.ReactNode;
  rightPanel: React.ReactNode;
}

const ThreePanel = ({ leftPanel, middlePanel, rightPanel }: ThreePanelProps) => {
  return (
    <div className="three-panel">
      <div className="three-panel-left">{leftPanel}</div>
      <div className="three-panel-middle">{middlePanel}</div>
      <div className="three-panel-right">{rightPanel}</div>
    </div>
  );
};

export default ThreePanel;
