import React from 'react';
import './FormulaKeyboard.css';

interface FormulaKeyboardProps {
  onKeyPress: (value: string) => void;
  variables?: string[];
}

const FormulaKeyboard: React.FC<FormulaKeyboardProps> = ({ onKeyPress, variables = [] }) => {
  const numbers = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.'];
  const mainOperators = [
    { symbol: '+', display: '+' },
    { symbol: '-', display: '−' },
    { symbol: '*', display: '×' },
    { symbol: '/', display: '÷' },
    { symbol: '(', display: '(' },
    { symbol: ')', display: ')' },
    { symbol: 'abs(', display: '|x|' },
  ];
  const comparisonOperators = [
    { symbol: '=', display: '=' },
    { symbol: '>', display: '>' },
    { symbol: '<', display: '<' },
    { symbol: '>=', display: '≥' },
    { symbol: '<=', display: '≤' },
    { symbol: 'backspace', display: '⌫' },
  ];

  const logicalOperators = [
    { symbol: ' and ', display: 'И' },
    { symbol: ' or ', display: 'ИЛИ' },
  ];

  // Разбиваем переменные на группы по 3
  const variableGroups = variables.reduce((acc, variable, index) => {
    const groupIndex = Math.floor(index / 3);
    if (!acc[groupIndex]) {
      acc[groupIndex] = [];
    }
    acc[groupIndex].push(variable);
    return acc;
  }, [] as string[][]);

  const handleOperatorClick = (op: { symbol: string; display: string } | string) => {
    if (typeof op === 'object') {
      if (op.symbol === 'backspace') {
        onKeyPress('backspace');
      } else {
        onKeyPress(op.symbol);
      }
    } else {
      onKeyPress(op);
    }
  };

  return (
    <div className="formula-keyboard">
      <div className="keyboard-section comparison-operators">
        {comparisonOperators.map(op => (
          <button
            key={op.symbol}
            onClick={() => handleOperatorClick(op)}
            className="keyboard-button operator"
            type="button"
          >
            {op.display}
          </button>
        ))}
      </div>

      <div className="keyboard-section logical-operators">
        {logicalOperators.map(op => (
          <button
            key={op.symbol}
            onClick={() => handleOperatorClick(op)}
            className="keyboard-button logical"
            type="button"
          >
            {op.display}
          </button>
        ))}
      </div>

      <div className="keyboard-layout">
        <div className="left-section">
          <div className="numbers-section">
            {numbers.map(num => (
              <button
                key={num}
                onClick={() => handleOperatorClick(num)}
                className="keyboard-button operator"
                type="button"
              >
                {num}
              </button>
            ))}
          </div>

          {variables.length > 0 && (
            <div className="keyboard-section variables">
              <div className="section-title">Переменные:</div>
              <div className="variables-grid">
                {variableGroups.map((group, groupIndex) =>
                  group.map((variable, index) => (
                    <button
                      key={`${groupIndex}-${index}`}
                      onClick={() => onKeyPress(variable)}
                      className="keyboard-button variable"
                      type="button"
                    >
                      {variable}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="main-operators-section">
          {mainOperators.map(op => (
            <button
              key={op.symbol}
              onClick={() => handleOperatorClick(op)}
              className="keyboard-button operator"
              type="button"
            >
              {op.display}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FormulaKeyboard;
