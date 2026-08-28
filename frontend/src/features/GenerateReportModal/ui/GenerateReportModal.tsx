import { getDateRangePresets } from '@/shared/lib/formatting';
import { FormField } from '@/shared/ui/FormField';
import { DatePicker, RangePicker, Select } from '@/shared/ui/FormItems';
import { Modal } from '@/shared/ui/Modal';
import { useGenerateReportModal } from '../model/useGenerateReportModal';
import type { Dayjs } from 'dayjs';
import './GenerateReportModal.css';

interface GenerateReportModalProps {
  open: boolean;
  onClose: () => void;
  laboratoryId: number;
  departmentId?: number;
}

const GenerateReportModal = ({
  open,
  onClose,
  laboratoryId,
  departmentId,
}: GenerateReportModalProps) => {
  const modal = useGenerateReportModal({ open, onClose, laboratoryId, departmentId });

  if (!open) {
    return null;
  }

  return (
    <Modal
      header="Формирование отчета"
      onClose={onClose}
      onCancel={onClose}
      cancelText="Отмена"
      onGenerate={modal.handleGenerate}
      generateButtonText="Сформировать"
      generateLoading={modal.loading}
      modalWidth="550"
    >
      <div className="generate-report-modal-content">
        <FormField
          label="Тип отчета"
          labelClassName="generate-report-modal-label"
          itemClassName="generate-report-modal-field"
        >
          {fieldId => (
            <Select
              id={fieldId}
              placeholder="Выберите тип отчета"
              value={modal.reportType}
              onChange={(v: unknown) =>
                modal.setReportType((v as string) ?? modal.defaultReportType)
              }
              options={modal.reportTypes}
              style={{ width: '100%' }}
            />
          )}
        </FormField>
        {modal.isPhysicochemical ? (
          <FormField
            label="Место отбора проб"
            labelClassName="generate-report-modal-label"
            itemClassName="generate-report-modal-field"
          >
            {fieldId => (
              <Select
                id={fieldId}
                placeholder="Выберите место отбора"
                value={modal.samplingLocation}
                onChange={(v: unknown) =>
                  modal.setSamplingLocation(
                    (v as string) ?? modal.physicochemicalLocations[0]?.value ?? ''
                  )
                }
                options={modal.physicochemicalLocations}
                style={{ width: '100%' }}
              />
            )}
          </FormField>
        ) : null}
        {modal.isNks ? (
          <FormField
            label="Месяц и год отчета"
            labelClassName="generate-report-modal-label"
            itemClassName="generate-report-modal-field"
          >
            {fieldId => (
              <DatePicker
                id={fieldId}
                picker="month"
                disableYearNavigation={false}
                inputReadOnly
                value={modal.reportPeriod}
                onChange={date => modal.setReportPeriod((date as Dayjs | null) ?? null)}
                format="MMMM YYYY"
                className="generate-report-modal-picker"
                style={{ width: '100%' }}
              />
            )}
          </FormField>
        ) : null}
        <FormField
          label={modal.dateLabel}
          labelClassName="generate-report-modal-label"
          itemClassName="generate-report-modal-field"
        >
          {fieldId => (
            <RangePicker
              id={fieldId}
              value={modal.dateRange}
              onChange={dates => modal.setDateRange(dates ?? [null, null])}
              presets={getDateRangePresets()}
              className="generate-report-modal-picker"
              style={{ width: '100%' }}
            />
          )}
        </FormField>
      </div>
    </Modal>
  );
};

export default GenerateReportModal;
