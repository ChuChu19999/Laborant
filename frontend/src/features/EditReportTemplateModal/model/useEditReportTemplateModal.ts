import { useEffect, useState } from 'react';
import {
  useAvailableReportTemplates,
  useCreateReportTemplate,
  useReportTemplate,
  useUpdateReportTemplate,
} from '@/entities/Report';
import { extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

export type UseEditReportTemplateModalParams = {
  open: boolean;
  onClose: () => void;
  laboratoryId: number;
  departmentId?: number;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (base64 === undefined) {
        reject(new Error('Ошибка при чтении файла шаблона'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл шаблона'));
  });
};

/** Оркестрация модалки шаблонов отчетов: выбор/создание/обновление файла. */
export const useEditReportTemplateModal = ({
  open,
  onClose,
  laboratoryId,
  departmentId,
}: UseEditReportTemplateModalParams) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isEditingFile, setIsEditingFile] = useState(false);

  const createTemplateMutation = useCreateReportTemplate();
  const updateTemplateMutation = useUpdateReportTemplate();
  const loading = createTemplateMutation.isPending || updateTemplateMutation.isPending;

  const { data: availableTemplates = [], isLoading: templatesLoading } =
    useAvailableReportTemplates(laboratoryId, departmentId, open && !!laboratoryId);

  const templates = availableTemplates.filter(t => !t.deleted_at);

  const { data: activeTemplate, isLoading: templateLoading } = useReportTemplate(
    selectedTemplateId,
    open && !!selectedTemplateId
  );

  useEffect(() => {
    if (!open) {
      setSelectedTemplateId(null);
      setIsCreatingNew(false);
      setSelectedReportType('');
      setSelectedFile(null);
      setErrors({});
      setIsEditingFile(false);
    }
  }, [open]);

  useEffect(() => {
    setIsEditingFile(false);
    setSelectedFile(null);
  }, [selectedTemplateId]);

  const handleTemplateChange = (value: unknown) => {
    if (value === 'new') {
      setIsCreatingNew(true);
      setSelectedTemplateId(null);
      setSelectedReportType('');
    } else if (typeof value === 'number') {
      setIsCreatingNew(false);
      setSelectedTemplateId(value);
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setErrors(prev => ({ ...prev, file: '' }));
    return false;
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setErrors(prev => ({ ...prev, file: '' }));
  };

  const setReportType = (value: string) => {
    setSelectedReportType(value);
    setErrors(prev => ({ ...prev, report_type: '' }));
  };

  const startEditingFile = () => {
    setIsEditingFile(true);
  };

  const handleCreateNewTemplate = async () => {
    if (!selectedReportType) {
      setErrors(prev => ({ ...prev, report_type: 'Выберите тип отчета' }));
      return;
    }

    if (!selectedFile) {
      setErrors(prev => ({ ...prev, file: 'Выберите файл шаблона' }));
      return;
    }

    try {
      const fileBase64 = await fileToBase64(selectedFile);

      const createdTemplate = await createTemplateMutation.mutateAsync({
        report_type: selectedReportType,
        file_name: selectedFile.name,
        file: fileBase64,
        laboratory_id: laboratoryId,
        department_id: departmentId,
      });

      setSelectedTemplateId(createdTemplate.id);
      setIsCreatingNew(false);
      setSelectedReportType('');
      setSelectedFile(null);
    } catch (error) {
      notify.error(extractErrorMessage(error, 'Не удалось создать шаблон отчета'));
    }
  };

  const handleUpdateTemplateFile = async () => {
    if (!activeTemplate || !selectedFile) {
      notify.error('Выберите файл для обновления');
      return;
    }

    try {
      const fileBase64 = await fileToBase64(selectedFile);

      const updatedTemplate = await updateTemplateMutation.mutateAsync({
        id: activeTemplate.id,
        data: {
          file: fileBase64,
          file_name: selectedFile.name,
        },
      });

      setSelectedTemplateId(updatedTemplate.id);
      setSelectedFile(null);
      setIsEditingFile(false);
    } catch (error) {
      notify.error(extractErrorMessage(error, 'Не удалось обновить шаблон отчета'));
    }
  };

  const handleSave = async () => {
    try {
      if (isCreatingNew) {
        await handleCreateNewTemplate();
        return;
      }

      if (!activeTemplate) {
        notify.info('Выберите шаблон для редактирования');
        return;
      }

      if (isEditingFile && selectedFile) {
        await handleUpdateTemplateFile();
        return;
      }

      notify.info('Нет изменений для сохранения');
    } catch (error) {
      notify.error(extractErrorMessage(error, 'Ошибка при сохранении изменений'));
    }
  };

  const handleModalClose = () => {
    setSelectedTemplateId(null);
    setIsCreatingNew(false);
    setSelectedReportType('');
    setSelectedFile(null);
    setErrors({});
    setIsEditingFile(false);
    onClose();
  };

  return {
    selectedTemplateId,
    isCreatingNew,
    selectedReportType,
    selectedFile,
    errors,
    isEditingFile,
    loading,
    templates,
    templatesLoading,
    activeTemplate,
    templateLoading,
    shouldShowSaveButton: selectedFile !== null,
    handleTemplateChange,
    handleFileSelect,
    clearSelectedFile,
    setReportType,
    startEditingFile,
    handleSave,
    handleModalClose,
  };
};
