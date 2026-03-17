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
const REPORT_TYPES = [{ value: REPORT_TYPE_SAMPLE_COUNT, label: REPORT_TYPE_SAMPLE_COUNT }];

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
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [loading, setLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!dateRange[0] || !dateRange[1]) {
      message.warning('Выберите период (даты получения пробы)');
      return;
    }
    if (reportType !== REPORT_TYPE_SAMPLE_COUNT) {
      message.warning('Выбранный тип отчёта пока не реализован');
      return;
    }
    setLoading(true);
    try {
      const blob = await reportsApi.generateSampleCountReport({
        laboratory_id: laboratoryId,
        department_id: departmentId,
        date_from: dateRange[0].format('YYYY-MM-DD'),
        date_to: dateRange[1].format('YYYY-MM-DD'),
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Количество_проб_${dateRange[0].format('YYYY-MM-DD')}_${dateRange[1].format('YYYY-MM-DD')}.xlsx`;
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
  }, [laboratoryId, departmentId, dateRange, reportType, onClose]);

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
        <div className="generate-report-modal-field">
          <label className="generate-report-modal-label">Период (дата получения пробы)</label>
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
