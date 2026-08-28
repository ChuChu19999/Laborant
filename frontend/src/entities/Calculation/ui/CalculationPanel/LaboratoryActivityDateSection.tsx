import { DatePicker } from '@/shared/ui/FormItems';
import type { Dayjs } from 'dayjs';

interface LaboratoryActivityDateSectionProps {
  value: Dayjs | null;
  error: string;
  onChange: (date: Dayjs | null) => void;
}

const LaboratoryActivityDateSection = ({
  value,
  error,
  onChange,
}: LaboratoryActivityDateSectionProps) => {
  return (
    <div className="calculation-panel-date-section">
      <div className="calculation-panel-date-label">Дата лабораторной деятельности</div>
      <div className="calculation-panel-date-wrapper">
        <DatePicker
          value={value}
          onChange={date => {
            onChange((date ?? null) as Dayjs | null);
          }}
          placeholder="Введите дату лабораторной деятельности"
          showToday
          allowClear={true}
          className={`calculation-panel-date-picker ${error ? 'calculation-panel-date-picker-error' : ''}`}
          status={error ? 'error' : undefined}
        />
        {error && <div className="calculation-panel-date-error">{error}</div>}
      </div>
    </div>
  );
};

export default LaboratoryActivityDateSection;
