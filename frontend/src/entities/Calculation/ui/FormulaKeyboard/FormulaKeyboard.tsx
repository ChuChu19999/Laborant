import './FormulaKeyboard.css';

interface FormulaKeyboardProps {
  onKeyPress: (value: string) => void;
  variables?: string[];
}

const FormulaKeyboard = ({ onKeyPress, variables = [] }: FormulaKeyboardProps) => {
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

  const variableGroups = variables.reduce<string[][]>((acc, variable, index) => {
    const groupIndex = Math.floor(index / 3);
    if (!acc[groupIndex]) {
      acc[groupIndex] = [];
    }
    acc[groupIndex].push(variable);
    return acc;
  }, []);

  const handleOperatorClick = (op: { symbol: string; display: string } | string) => {
    if (typeof op === 'object' && op.symbol === 'backspace') {
      onKeyPress('backspace');
    } else {
      onKeyPress(typeof op === 'string' ? op : op.symbol);
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
                {variableGroups.map(group =>
                  group.map(variable => (
                    <button
                      key={variable}
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
