import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import {
  reportKeys,
  reportsApi,
  type ReportTemplate,
  type ReportTemplateCreate,
  type ReportTemplateUpdate,
} from '../api';

/** Создаёт шаблон отчёта и инвалидирует кэш списка. */
export const useCreateReportTemplate = () => {
  return useAutoInvalidateMutation<ReportTemplate, unknown, ReportTemplateCreate>(
    data => reportsApi.createReportTemplate(data),
    [reportKeys.all],
    {
      onSuccess: () => {
        notify.success('Шаблон отчёта создан');
      },
    }
  );
};

/** Обновляет шаблон отчёта и инвалидирует кэш списка. */
export const useUpdateReportTemplate = () => {
  return useAutoInvalidateMutation<
    ReportTemplate,
    unknown,
    { id: number; data: ReportTemplateUpdate }
  >(({ id, data }) => reportsApi.updateReportTemplate(id, data), [reportKeys.all], {
    onSuccess: () => {
      notify.success('Шаблон отчёта обновлён');
    },
  });
};

type SampleCountParams = {
  laboratory_id: number;
  department_id?: number;
  template_id?: number;
  date_from: string;
  date_to: string;
};

type PhysicochemicalParams = SampleCountParams & { sampling_location: string };

type NksParams = SampleCountParams & { report_month: number; report_year: number };

/** Генерирует отчёт физико-химической характеристики. */
export const useGeneratePhysicochemicalReport = () => {
  return useAutoInvalidateMutation<
    { blob: Blob; filename: string },
    unknown,
    PhysicochemicalParams
  >(params => reportsApi.generatePhysicochemicalReport(params), []);
};

/** Генерирует отчёт «Количество проб». */
export const useGenerateSampleCountReport = () => {
  return useAutoInvalidateMutation<{ blob: Blob; filename: string }, unknown, SampleCountParams>(
    params => reportsApi.generateSampleCountReport(params),
    []
  );
};

/** Генерирует отчёт КГС. */
export const useGenerateKgsReport = () => {
  return useAutoInvalidateMutation<{ blob: Blob; filename: string }, unknown, SampleCountParams>(
    params => reportsApi.generateKgsReport(params),
    []
  );
};

/** Генерирует отчёт НКС. */
export const useGenerateNksReport = () => {
  return useAutoInvalidateMutation<{ blob: Blob; filename: string }, unknown, NksParams>(
    params => reportsApi.generateNksReport(params),
    []
  );
};
