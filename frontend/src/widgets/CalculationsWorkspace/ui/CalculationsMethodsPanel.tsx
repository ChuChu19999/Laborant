import { getFirstGroupMethodId } from '@/entities/ResearchMethod';
import { Spin } from '@/shared/ui/Spin';
import type { AvailableMethod } from '../model/types';

export type { AvailableMethod };

interface CalculationsMethodsPanelProps {
  isLoading: boolean;
  availableMethods: AvailableMethod[];
  selectedMethodId: number | null;
  onMethodClick: (methodId: number) => void;
}

const formatMethodName = (name: string): string => {
  if (name === 'Фракционный состав (конденсат)') {
    return 'Конденсат';
  }
  if (name === 'Фракционный состав (нефть)') {
    return 'Нефть';
  }
  return name;
};

const CalculationsMethodsPanel = ({
  isLoading,
  availableMethods,
  selectedMethodId,
  onMethodClick,
}: CalculationsMethodsPanelProps) => {
  return (
    <div className="calculations-page-left-panel">
      <div className="calculations-page-left-panel-header">
        <h3 className="calculations-page-left-panel-title">Методы исследования</h3>
      </div>
      <div className="calculations-page-left-panel-content">
        {isLoading ? (
          <div className="calculations-page-empty calculations-page-spinner">
            <Spin spinning>
              <div className="calculations-page-spinner-placeholder" />
            </Spin>
          </div>
        ) : availableMethods.length === 0 ? (
          <div className="calculations-page-empty">Нет доступных методов исследования</div>
        ) : (
          <div className="calculations-page-methods-list">
            {availableMethods.map(method => {
              const isActive =
                method.is_group && method.methods
                  ? method.methods.some(m => m.id === selectedMethodId)
                  : method.id === selectedMethodId;

              return (
                <button
                  type="button"
                  key={method.id}
                  className={`calculations-page-method-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (method.is_group && method.methods && method.methods.length > 0) {
                      const firstGroupMethodId = getFirstGroupMethodId(method.methods);
                      if (firstGroupMethodId != null) {
                        onMethodClick(firstGroupMethodId);
                      }
                    } else if (!method.is_group && typeof method.id === 'number') {
                      onMethodClick(method.id);
                    }
                  }}
                >
                  <span className="calculations-page-method-name">
                    {formatMethodName(method.name)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalculationsMethodsPanel;
