import { useState } from 'react';
import dayjs from 'dayjs';
import {
  REPORT_TYPES as REPORT_TYPE_VALUES,
  useGenerateKgsReport,
  useGenerateNksReport,
  useGeneratePhysicochemicalReport,
  useGenerateSampleCountReport,
} from '@/entities/Report';
import { extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';
import type { Dayjs } from 'dayjs';

export const REPORT_TYPE_SAMPLE_COUNT = REPORT_TYPE_VALUES[0];
export const REPORT_TYPE_PHYSICOCHEMICAL = REPORT_TYPE_VALUES[1];
export const REPORT_TYPE_KGS = REPORT_TYPE_VALUES[2];
export const REPORT_TYPE_NKS = REPORT_TYPE_VALUES[3];

export const GENERATE_REPORT_TYPES = [
  { value: REPORT_TYPE_SAMPLE_COUNT, label: REPORT_TYPE_SAMPLE_COUNT },
  { value: REPORT_TYPE_PHYSICOCHEMICAL, label: REPORT_TYPE_PHYSICOCHEMICAL },
  { value: REPORT_TYPE_KGS, label: REPORT_TYPE_KGS },
  { value: REPORT_TYPE_NKS, label: REPORT_TYPE_NKS },
];

export const PHYSICOCHEMICAL_SAMPLING_LOCATIONS = [
  { value: 'ЦДГГКН №1', label: 'ЦДГГКН №1' },
  { value: 'ЦДГГКН №2', label: 'ЦДГГКН №2' },
];

export type UseGenerateReportModalParams = {
  open: boolean;
  onClose: () => void;
  laboratoryId: number;
  departmentId?: number;
};

/** Оркестрация модалки формирования отчетов. */
export const useGenerateReportModal = ({
  onClose,
  laboratoryId,
  departmentId,
}: UseGenerateReportModalParams) => {
  const [reportType, setReportType] = useState<string>(REPORT_TYPE_SAMPLE_COUNT);
  const [samplingLocation, setSamplingLocation] = useState<string>(
    PHYSICOCHEMICAL_SAMPLING_LOCATIONS[0]?.value ?? ''
  );
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [reportPeriod, setReportPeriod] = useState<Dayjs | null>(dayjs());

  const sampleCountMutation = useGenerateSampleCountReport();
  const physicochemicalMutation = useGeneratePhysicochemicalReport();
  const kgsMutation = useGenerateKgsReport();
  const nksMutation = useGenerateNksReport();

  const loading =
    sampleCountMutation.isPending ||
    physicochemicalMutation.isPending ||
    kgsMutation.isPending ||
    nksMutation.isPending;

  const isPhysicochemical = reportType === REPORT_TYPE_PHYSICOCHEMICAL;
  const isKgs = reportType === REPORT_TYPE_KGS;
  const isNks = reportType === REPORT_TYPE_NKS;
  const usesSamplingDate = isPhysicochemical || isKgs || isNks;
  const dateLabel = usesSamplingDate
    ? 'Период (дата отбора проб)'
    : 'Период (дата поступления проб)';

  const handleGenerate = async () => {
    if (!dateRange[0] || !dateRange[1]) {
      notify.warning(`Выберите период (${dateLabel.toLowerCase()})`);
      return;
    }
    if (isPhysicochemical && !samplingLocation) {
      notify.warning('Выберите место отбора проб');
      return;
    }
    if (isNks && !reportPeriod) {
      notify.warning('Выберите месяц и год отчета');
      return;
    }

    const nksReportMonth = reportPeriod ? reportPeriod.month() + 1 : undefined;
    const nksReportYear = reportPeriod ? reportPeriod.year() : undefined;

    try {
      const dateFrom = dateRange[0].format('YYYY-MM-DD');
      const dateTo = dateRange[1].format('YYYY-MM-DD');
      const baseParams = {
        laboratory_id: laboratoryId,
        department_id: departmentId,
        date_from: dateFrom,
        date_to: dateTo,
      };

      let reportFile: { blob: Blob; filename: string };
      if (isPhysicochemical) {
        reportFile = await physicochemicalMutation.mutateAsync({
          ...baseParams,
          sampling_location: samplingLocation,
        });
      } else if (isKgs) {
        reportFile = await kgsMutation.mutateAsync(baseParams);
      } else if (isNks && nksReportMonth && nksReportYear) {
        reportFile = await nksMutation.mutateAsync({
          ...baseParams,
          report_month: nksReportMonth,
          report_year: nksReportYear,
        });
      } else {
        reportFile = await sampleCountMutation.mutateAsync(baseParams);
      }

      const url = window.URL.createObjectURL(reportFile.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = reportFile.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      notify.success('Отчет успешно сформирован');
      onClose();
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Не удалось сформировать отчет'));
    }
  };

  return {
    reportType,
    setReportType,
    samplingLocation,
    setSamplingLocation,
    dateRange,
    setDateRange,
    reportPeriod,
    setReportPeriod,
    loading,
    isPhysicochemical,
    isNks,
    dateLabel,
    handleGenerate,
    reportTypes: GENERATE_REPORT_TYPES,
    physicochemicalLocations: PHYSICOCHEMICAL_SAMPLING_LOCATIONS,
    defaultReportType: REPORT_TYPE_SAMPLE_COUNT,
  };
};
