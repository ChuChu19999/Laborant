import { useEffect, useState } from 'react';
import {
  type CellStyle,
  useAvailableProtocolTemplates,
  useCreateProtocolTemplate,
  useProtocolTemplate,
  useSaveProtocolTemplateExcelSection,
} from '@/entities/Protocol';
import { extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

export const PROTOCOL_TEMPLATE_SECTIONS = [
  {
    id: 'header',
    name: 'Шапка',
    description: 'Редактирование шапки протокола',
  },
] as const;

export type ProtocolTemplateSection = (typeof PROTOCOL_TEMPLATE_SECTIONS)[number];

export type UseEditProtocolTemplateModalParams = {
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

/** Оркестрация модалки шаблонов протоколов: выбор/создание/Excel-секции. */
export const useEditProtocolTemplateModal = ({
  open,
  onClose,
  laboratoryId,
  departmentId,
}: UseEditProtocolTemplateModalParams) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSection, setSelectedSection] = useState<ProtocolTemplateSection | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [excelData, setExcelData] = useState<(string | null)[][] | null>(null);
  const [cellStyles, setCellStyles] = useState<Record<string, CellStyle>>({});

  const createTemplateMutation = useCreateProtocolTemplate();
  const saveExcelSectionMutation = useSaveProtocolTemplateExcelSection();

  const { data: availableTemplates = [], isLoading: templatesLoading } =
    useAvailableProtocolTemplates(laboratoryId, departmentId, open && !!laboratoryId);
  const templates = availableTemplates.filter(t => !t.deleted_at);

  const { data: activeTemplate, isLoading: templateLoading } = useProtocolTemplate(
    selectedTemplateId,
    open && !!selectedTemplateId
  );

  useEffect(() => {
    if (!open) {
      setSelectedTemplateId(null);
      setSelectedSection(null);
      setIsCreatingNew(false);
      setNewTemplateName('');
      setSelectedFile(null);
      setErrors({});
      setExcelData(null);
      setCellStyles({});
    }
  }, [open]);

  const handleTemplateChange = (value: unknown) => {
    if (value === 'new') {
      setIsCreatingNew(true);
      setSelectedTemplateId(null);
      setSelectedSection(null);
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

  const updateNewTemplateName = (value: string) => {
    setNewTemplateName(value);
    setErrors(prev => ({ ...prev, name: '' }));
  };

  const handleCreateNewTemplate = async () => {
    if (!newTemplateName.trim()) {
      setErrors(prev => ({ ...prev, name: 'Введите название шаблона' }));
      return;
    }

    if (!selectedFile) {
      setErrors(prev => ({ ...prev, file: 'Выберите файл шаблона' }));
      return;
    }

    try {
      setLoading(true);
      const fileBase64 = await fileToBase64(selectedFile);

      const createdTemplate = await createTemplateMutation.mutateAsync({
        name: newTemplateName.trim(),
        file_name: selectedFile.name,
        file: fileBase64,
        laboratory_id: laboratoryId,
        department_id: departmentId,
      });
      setSelectedTemplateId(createdTemplate.id);
      setIsCreatingNew(false);
      setNewTemplateName('');
      setSelectedFile(null);
      notify.success('Шаблон успешно добавлен');
    } catch (error) {
      notify.error(extractErrorMessage(error, 'Не удалось добавить шаблон'));
    } finally {
      setLoading(false);
    }
  };

  const handleSectionSelect = (section: ProtocolTemplateSection) => {
    setSelectedSection(section);
  };

  const handleDataChange = (
    newData: (string | null)[][],
    newTemplateId: number | null,
    styles: Record<string, CellStyle> | null
  ) => {
    setExcelData(newData);
    if (styles !== null) {
      setCellStyles(styles);
    }
    if (newTemplateId && selectedTemplateId !== newTemplateId) {
      setSelectedTemplateId(newTemplateId);
    }
  };

  const handleBackToSections = () => {
    setSelectedSection(null);
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

      if (!selectedSection) {
        notify.info('Выберите раздел для редактирования');
        return;
      }

      setLoading(true);

      if (selectedSection.id === 'header') {
        if (!excelData) {
          notify.error('Нет данных для сохранения');
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('data', JSON.stringify(excelData));
        formData.append('styles', JSON.stringify(cellStyles));
        formData.append('template_id', activeTemplate.id.toString());
        formData.append('section', selectedSection.id);

        const response = await saveExcelSectionMutation.mutateAsync(formData);

        if (response.template_id) {
          setSelectedTemplateId(response.template_id);
        }

        notify.success('Изменения сохранены');
        setSelectedSection(null);
        return;
      }
    } catch (error) {
      notify.error(extractErrorMessage(error, 'Ошибка при сохранении изменений'));
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    setSelectedTemplateId(null);
    setSelectedSection(null);
    setIsCreatingNew(false);
    setNewTemplateName('');
    setSelectedFile(null);
    setErrors({});
    setExcelData(null);
    setCellStyles({});
    onClose();
  };

  return {
    selectedTemplateId,
    loading,
    selectedSection,
    isCreatingNew,
    newTemplateName,
    selectedFile,
    errors,
    templates,
    templatesLoading,
    activeTemplate,
    templateLoading,
    sections: PROTOCOL_TEMPLATE_SECTIONS,
    handleTemplateChange,
    handleFileSelect,
    clearSelectedFile,
    updateNewTemplateName,
    handleSectionSelect,
    handleDataChange,
    handleBackToSections,
    handleSave,
    handleModalClose,
  };
};
