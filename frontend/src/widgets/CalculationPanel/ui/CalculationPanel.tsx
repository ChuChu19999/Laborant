import React from 'react';
import './CalculationPanel.css';

interface CalculationPanelProps {
  hasNoMethods: boolean;
}

const CalculationPanel: React.FC<CalculationPanelProps> = ({ hasNoMethods }) => {
  return (
    <div className="calculation-panel">
      {hasNoMethods ? (
        <div className="calculation-panel-empty">
          <h3 className="calculation-panel-empty-title">Методы исследования отсутствуют</h3>
          <p className="calculation-panel-empty-description">
            Добавьте первый метод исследования, нажав на кнопку "+" в левой панели
          </p>
        </div>
      ) : (
        <p>Панель расчетов будет здесь</p>
      )}
    </div>
  );
};

export default CalculationPanel;
