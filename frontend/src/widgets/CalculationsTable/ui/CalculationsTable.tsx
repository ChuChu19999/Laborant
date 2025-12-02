import { useState } from 'react';
import { type Dayjs } from 'dayjs';
import { LoadingCard } from '../../../features/Cards';
import { SaveCalculationModal } from '../../../features/Modals';
import { CalculationForm } from '../../CalculationForm';
import type { CalculationResponse } from '../../../shared/api/calculation';
import type { ResearchMethodResponse } from '../../../shared/api/research';
import './CalculationsTable.css';

interface CalculationsTableProps {
  calculations: CalculationResponse[];
  isLoading?: boolean;
  selectedMethod: ResearchMethodResponse | null;
  laboratoryId: number;
  departmentId?: number;
  onAddClick: () => void;
}

const CalculationsTable: React.FC<CalculationsTableProps> = ({
  calculations,
  isLoading = false,
  selectedMethod,
  laboratoryId,
  departmentId,
  onAddClick,
}) => {
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [isLoadingRegistrationData] = useState(false);
  const [calculationResult, setCalculationResult] = useState<{
    result: string;
    measurement_error?: string;
    intermediate_data?: Record<string, unknown>;
    input_data: Record<string, unknown>;
    laboratory_activity_date: Dayjs | null;
  } | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  if (!selectedMethod) {
    return (
      <div className="calculations-panel">
        <div className="no-method-selected">
          <p>Выберите метод исследования из списка слева</p>
        </div>
      </div>
    );
  }

  const handleCalculationComplete = (result: {
    result: string;
    measurement_error?: string;
    intermediate_data?: Record<string, unknown>;
    input_data: Record<string, unknown>;
    laboratory_activity_date: Dayjs | null;
  }) => {
    setCalculationResult(result);
    setIsLocked(true);
  };

  const handleSaveSuccess = () => {
    setCalculationResult(null);
    setIsLocked(false);
    setRegistrationNumber('');
  };

  return (
    <div className="calculations-panel">
      <div className="calculations-header">
        <h3>Расчеты: {selectedMethod.name}</h3>
        <button className="add-calculation-btn" onClick={onAddClick}>
          + Добавить расчет
        </button>
      </div>

      <div className="calculations-content">
        {/* Форма расчета */}
        <div className="calculation-form-section">
          <CalculationForm
            method={selectedMethod}
            laboratoryId={laboratoryId}
            departmentId={departmentId}
            registrationNumber={registrationNumber}
            onRegistrationNumberChange={setRegistrationNumber}
            isLoadingRegistrationData={isLoadingRegistrationData}
            onCalculationComplete={handleCalculationComplete}
            onSaveClick={() => setIsSaveModalOpen(true)}
            isLocked={isLocked}
          />
        </div>

        {/* Таблица расчетов */}
        <div className="calculations-table-section">
          {isLoading ? (
            <LoadingCard />
          ) : (
            <div className="calculations-list">
              {calculations.length === 0 ? (
                <div className="empty-calculations">
                  <p>Расчеты не найдены</p>
                </div>
              ) : (
                <div className="calculations-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Регистрационный номер</th>
                        <th>Результат</th>
                        <th>Единица измерения</th>
                        <th>Дата</th>
                        <th>Исполнитель</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculations.map(calc => (
                        <tr key={calc.id}>
                          <td>
                            {typeof calc.sample === 'object' && calc.sample
                              ? (calc.sample as { registration_number?: string })
                                  .registration_number || '-'
                              : '-'}
                          </td>
                          <td>{calc.result}</td>
                          <td>{calc.unit || selectedMethod.unit}</td>
                          <td>
                            {calc.laboratory_activity_date
                              ? new Date(calc.laboratory_activity_date).toLocaleDateString('ru-RU')
                              : '-'}
                          </td>
                          <td>{calc.executor || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {calculationResult && selectedMethod && (
        <SaveCalculationModal
          open={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          onSuccess={handleSaveSuccess}
          calculationResult={{
            result: calculationResult.result,
            measurement_error: calculationResult.measurement_error,
            input_data: calculationResult.input_data,
            laboratory_activity_date: calculationResult.laboratory_activity_date,
          }}
          currentMethod={selectedMethod}
          laboratoryId={laboratoryId}
          departmentId={departmentId}
        />
      )}
    </div>
  );
};

export default CalculationsTable;
