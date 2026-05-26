import React, { useState, useCallback } from 'react';
import { message } from 'antd';
import { reportsApi } from '../../../../shared/api/reports';
import { getDateRangePresets } from '../../../../shared/lib/datePresets';
import { extractErrorMessage } from '../../../../shared/lib/errors/extractErrorMessage';
import { RangePicker, Select } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import type { Dayjs } from 'dayjs';
import './GenerateReportModal.css';

const REPORT_TYPE_SAMPLE_COUNT = 'Количество проб';
const REPORT_TYPE_PHYSICOCHEMICAL = 'Физико-химическая характеристика';

const REPORT_TYPES = [
  { value: REPORT_TYPE_SAMPLE_COUNT, label: REPORT_TYPE_SAMPLE_COUNT },
  { value: REPORT_TYPE_PHYSICOCHEMICAL, label: REPORT_TYPE_PHYSICOCHEMICAL },
];

const PHYSICOCHEMICAL_SAMPLING_LOCATIONS = [
  { value: 'ЦДГГКН №1', label: 'ЦДГГКН №1' },
  { value: 'ЦДГГКН №2', label: 'ЦДГГКН №2' },
];

interface GenerateReportModalProps {
  open: boolean;
  onClose: () => void;
  laboratoryId: number;
  departmentId?: number;
}

const GenerateReportModal: React.FC<GenerateReportModalProps> = ({
  open,
  onClose,
  laboratoryId,
  departmentId,
}) => {
  const [reportType, setReportType] = useState<string>(REPORT_TYPE_SAMPLE_COUNT);
  const [samplingLocation, setSamplingLocation] = useState<string>('ЦДГГКН №1');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [loading, setLoading] = useState(false);

  const isPhysicochemical = reportType === REPORT_TYPE_PHYSICOCHEMICAL;
  const dateLabel = isPhysicochemical
    ? 'Период (дата отбора пробы)'
    : 'Период (дата получения пробы)';

  const handleGenerate = useCallback(async () => {
    if (!dateRange[0] || !dateRange[1]) {
      message.warning(`Выберите период (${dateLabel.toLowerCase()})`);
      return;
    }
    if (isPhysicochemical && !samplingLocation) {
      message.warning('Выберите место отбора пробы');
      return;
    }

    setLoading(true);
    try {
      const dateFrom = dateRange[0].format('YYYY-MM-DD');
      const dateTo = dateRange[1].format('YYYY-MM-DD');
      const baseParams = {
        laboratory_id: laboratoryId,
        department_id: departmentId,
        date_from: dateFrom,
        date_to: dateTo,
      };

      const reportFile = isPhysicochemical
        ? await reportsApi.generatePhysicochemicalReport({
            ...baseParams,
            sampling_location: samplingLocation,
          })
        : await reportsApi.generateSampleCountReport(baseParams);

      const url = window.URL.createObjectURL(reportFile.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = reportFile.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      message.success('Отчёт успешно сформирован');
      onClose();
    } catch (err) {
      message.error(extractErrorMessage(err, 'Не удалось сформировать отчёт'));
    } finally {
      setLoading(false);
    }
  }, [
    laboratoryId,
    departmentId,
    dateRange,
    isPhysicochemical,
    samplingLocation,
    dateLabel,
    onClose,
  ]);

  if (!open) {
    return null;
  }

  return (
    <Modal
      header="Формирование отчёта"
      onClose={onClose}
      onCancel={onClose}
      cancelText="Отмена"
      onGenerate={handleGenerate}
      generateButtonText="Сформировать"
      generateLoading={loading}
      modalWidth="550"
    >
      <div className="generate-report-modal-content">
        <div className="generate-report-modal-field">
          <label className="generate-report-modal-label">Тип отчёта</label>
          <Select
            placeholder="Выберите тип отчёта"
            value={reportType}
            onChange={(v: unknown) => setReportType((v as string) ?? REPORT_TYPE_SAMPLE_COUNT)}
            options={REPORT_TYPES}
            style={{ width: '100%' }}
          />
        </div>
        {isPhysicochemical && (
          <div className="generate-report-modal-field">
            <label className="generate-report-modal-label">Место отбора пробы</label>
            <Select
              placeholder="Выберите место отбора"
              value={samplingLocation}
              onChange={(v: unknown) =>
                setSamplingLocation((v as string) ?? PHYSICOCHEMICAL_SAMPLING_LOCATIONS[0].value)
              }
              options={PHYSICOCHEMICAL_SAMPLING_LOCATIONS}
              style={{ width: '100%' }}
            />
          </div>
        )}
        <div className="generate-report-modal-field">
          <label className="generate-report-modal-label">{dateLabel}</label>
          <RangePicker
            value={dateRange}
            onChange={dates => setDateRange(dates ?? [null, null])}
            presets={getDateRangePresets()}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </Modal>
  );
};

export default GenerateReportModal;
