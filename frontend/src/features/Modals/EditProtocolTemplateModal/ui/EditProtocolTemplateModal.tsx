import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  InboxOutlined,
  NumberOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { message, Spin, Upload } from 'antd';
import { ExcelEditor } from '../../../../entities/ExcelEditor';
import {
  protocolsApi,
  type CellStyle,
  type ProtocolTemplate,
} from '../../../../shared/api/protocols';
import { useAutoRefetchQuery } from '../../../../shared/model/lib/useQuery';
import Button from '../../../../shared/ui/Button/Button';
import { Input, Select } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import './EditProtocolTemplateModal.css';

const { Dragger } = Upload;
const { Option } = Select;

const SECTIONS = [
  {
    id: 'header',
    name: 'Шапка',
    description: 'Редактирование шапки протокола',
    icon: <FileTextOutlined />,
  },
  {
    id: 'accreditation',
    name: 'Аккредитация',
    description: 'Настройка строки шапки аккредитации',
    icon: <NumberOutlined />,
  },
];

interface EditProtocolTemplateModalProps {
  open: boolean;
  onClose: () => void;
  laboratoryId: number;
  departmentId?: number;
}

const EditProtocolTemplateModal: React.FC<EditProtocolTemplateModalProps> = ({
  open,
  onClose,
  laboratoryId,
  departmentId,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<ProtocolTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSection, setSelectedSection] = useState<(typeof SECTIONS)[0] | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [accreditationHeaderRow, setAccreditationHeaderRow] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [excelData, setExcelData] = useState<Array<Array<string | null>> | null>(null);
  const [cellStyles, setCellStyles] = useState<Record<string, CellStyle>>({});

  // Загрузка списка шаблонов
  const {
    data: templatesData,
    isLoading: templatesLoading,
    refetch: refetchTemplates,
  } = useAutoRefetchQuery(
    ['protocol-templates', laboratoryId, departmentId],
    () => protocolsApi.getProtocolTemplates(laboratoryId, departmentId),
    {
      enabled: open && !!laboratoryId,
    }
  );

  const templates = templatesData?.items.filter(t => !t.deleted_at) || [];

  // Загрузка активного шаблона
  const { data: templateData, isLoading: templateLoading } = useAutoRefetchQuery(
    ['protocol-template', selectedTemplateId],
    () => protocolsApi.getProtocolTemplate(selectedTemplateId!),
    {
      enabled: open && !!selectedTemplateId,
    }
  );

  useEffect(() => {
    if (templateData) {
      setActiveTemplate(templateData);
      if (templateData.accreditation_header_row) {
        setAccreditationHeaderRow(templateData.accreditation_header_row.toString());
      }
    }
  }, [templateData]);

  useEffect(() => {
    if (!open) {
      // Сброс состояния при закрытии
      setSelectedTemplateId(null);
      setActiveTemplate(null);
      setSelectedSection(null);
      setIsCreatingNew(false);
      setNewTemplateName('');
      setSelectedFile(null);
      setAccreditationHeaderRow('');
      setErrors({});
      setExcelData(null);
      setCellStyles({});
    }
  }, [open]);

  const handleTemplateChange = useCallback((value: unknown) => {
    if (value === 'new') {
      setIsCreatingNew(true);
      setSelectedTemplateId(null);
      setActiveTemplate(null);
      setSelectedSection(null);
    } else if (typeof value === 'number') {
      setIsCreatingNew(false);
      setSelectedTemplateId(value);
    }
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setErrors(prev => ({ ...prev, file: '' }));
    return false;
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Убираем префикс data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleCreateNewTemplate = useCallback(async () => {
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

      const templateData = {
        name: newTemplateName.trim(),
        file_name: selectedFile.name,
        file: fileBase64,
        laboratory_id: laboratoryId,
        department_id: departmentId,
      };

      const createdTemplate = await protocolsApi.createProtocolTemplate(templateData);
      setActiveTemplate(createdTemplate);
      setSelectedTemplateId(createdTemplate.id);
      setIsCreatingNew(false);
      setNewTemplateName('');
      setSelectedFile(null);
      message.success('Шаблон успешно добавлен');
      refetchTemplates();
    } catch (error) {
      console.error('Ошибка при добавлении шаблона:', error);
      message.error('Ошибка при добавлении шаблона');
    } finally {
      setLoading(false);
    }
  }, [newTemplateName, selectedFile, laboratoryId, departmentId, refetchTemplates]);

  const handleSectionSelect = useCallback(
    (section: (typeof SECTIONS)[0]) => {
      setSelectedSection(section);
      if (section.id === 'accreditation' && activeTemplate) {
        setAccreditationHeaderRow(activeTemplate.accreditation_header_row?.toString() || '');
      }
    },
    [activeTemplate]
  );

  const handleDataChange = useCallback(
    (
      newData: Array<Array<string | null>>,
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
    },
    [selectedTemplateId]
  );

  const handleBackToSections = useCallback(() => {
    setSelectedSection(null);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      // Если создаем новый шаблон
      if (isCreatingNew) {
        await handleCreateNewTemplate();
        return;
      }

      // Если не выбран шаблон
      if (!activeTemplate) {
        message.info('Выберите шаблон для редактирования');
        return;
      }

      // Если не выбрана секция
      if (!selectedSection) {
        message.info('Выберите раздел для редактирования');
        return;
      }

      setLoading(true);

      // Обработка секции шапки (header)
      if (selectedSection.id === 'header') {
        if (!excelData) {
          message.error('Нет данных для сохранения');
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('data', JSON.stringify(excelData));
        formData.append('styles', JSON.stringify(cellStyles));
        formData.append('template_id', activeTemplate.id.toString());
        formData.append('section', selectedSection.id);

        const response = await protocolsApi.saveExcelSection(formData);

        if (response.template_id) {
          setSelectedTemplateId(response.template_id);
          const updated = await protocolsApi.getProtocolTemplate(response.template_id);
          setActiveTemplate(updated);
        }

        message.success('Изменения сохранены');
        setSelectedSection(null);
        refetchTemplates();
        return;
      }

      // Обработка секции аккредитации
      if (selectedSection.id === 'accreditation') {
        const headerRow = parseInt(accreditationHeaderRow);
        if (isNaN(headerRow) || headerRow < 1) {
          message.error('Введите корректный номер строки (положительное целое число)');
          setLoading(false);
          return;
        }

        await protocolsApi.updateProtocolTemplate(activeTemplate.id, {
          accreditation_header_row: headerRow,
        });

        message.success('Номер строки шапки аккредитации успешно сохранен');
        setSelectedSection(null);
        refetchTemplates();
        if (selectedTemplateId) {
          // Обновляем данные шаблона
          const updated = await protocolsApi.getProtocolTemplate(selectedTemplateId);
          setActiveTemplate(updated);
        }
      }
    } catch (error) {
      console.error('Ошибка при сохранении:', error);
      message.error('Ошибка при сохранении изменений');
    } finally {
      setLoading(false);
    }
  }, [
    isCreatingNew,
    activeTemplate,
    selectedSection,
    accreditationHeaderRow,
    excelData,
    cellStyles,
    handleCreateNewTemplate,
    selectedTemplateId,
    refetchTemplates,
  ]);

  const handleModalClose = useCallback(() => {
    setSelectedTemplateId(null);
    setActiveTemplate(null);
    setSelectedSection(null);
    setIsCreatingNew(false);
    setNewTemplateName('');
    setSelectedFile(null);
    setAccreditationHeaderRow('');
    setErrors({});
    setExcelData(null);
    setCellStyles({});
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <Modal
      header={isCreatingNew ? 'Добавление нового шаблона' : 'Редактирование шаблона'}
      onClose={handleModalClose}
      onCancel={handleModalClose}
      onSave={handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="1000"
    >
      <div className="edit-protocol-template-modal-content">
        {!isCreatingNew && (
          <div className="template-select-section">
            <Select
              placeholder="Выберите шаблон протокола"
              onChange={handleTemplateChange}
              value={selectedTemplateId || undefined}
              style={{ width: '100%', marginBottom: 24 }}
              loading={templatesLoading}
              dropdownRender={menu => (
                <>
                  {menu}
                  <div className="select-dropdown-divider" />
                  <div className="select-dropdown-item" onClick={() => handleTemplateChange('new')}>
                    <PlusOutlined /> Добавить новый шаблон
                  </div>
                </>
              )}
            >
              {templates.map(template => (
                <Option key={template.id} value={template.id}>
                  {template.name} - {template.version}
                </Option>
              ))}
            </Select>
          </div>
        )}

        {isCreatingNew ? (
          <div className="new-template-form">
            {loading ? (
              <div className="loading-state">
                <Spin size="large" />
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">
                    Название шаблона <span className="form-label-required">*</span>
                  </label>
                  <Input
                    placeholder="Введите название шаблона"
                    value={newTemplateName}
                    onChange={e => {
                      setNewTemplateName(e.target.value);
                      setErrors(prev => ({ ...prev, name: '' }));
                    }}
                    className="template-name-input"
                    status={errors.name ? 'error' : ''}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Файл шаблона <span className="form-label-required">*</span>
                  </label>
                  <div className="upload-container">
                    {selectedFile ? (
                      <div className="selected-file">
                        <div className="file-info">
                          <FileExcelOutlined className="file-icon" />
                          <span className="file-name">{selectedFile.name}</span>
                        </div>
                        <div style={{ flex: 50 }} />
                        <Button
                          type="text"
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            setSelectedFile(null);
                            setErrors(prev => ({ ...prev, file: '' }));
                          }}
                          className="protocol-template-delete-button"
                          danger
                        />
                      </div>
                    ) : (
                      <Dragger
                        name="file"
                        multiple={false}
                        accept=".xlsx"
                        beforeUpload={handleFileSelect}
                        showUploadList={false}
                      >
                        <p className="ant-upload-drag-icon">
                          <InboxOutlined />
                        </p>
                        <p className="ant-upload-text">Нажмите или перетащите файл для загрузки</p>
                        <p className="ant-upload-hint">Поддерживаются только файлы формата .xlsx</p>
                      </Dragger>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : !selectedTemplateId ? (
          <div className="select-template-message">
            <p>Выберите шаблон для редактирования или добавьте новый</p>
          </div>
        ) : templateLoading ? (
          <div className="loading-state">
            <Spin size="large" />
          </div>
        ) : !activeTemplate ? (
          <div className="no-template-message">
            <p>Шаблон не найден</p>
          </div>
        ) : !selectedSection ? (
          <div className="sections-list">
            {SECTIONS.map(section => (
              <div
                key={section.id}
                className="section-item"
                onClick={() => handleSectionSelect(section)}
              >
                <span className="section-icon">{section.icon}</span>
                <div className="section-info">
                  <div className="section-name">{section.name}</div>
                  <div className="section-description">{section.description}</div>
                </div>
                <span className="section-arrow">→</span>
              </div>
            ))}
          </div>
        ) : selectedSection?.id === 'header' ? (
          <div className="editor-container">
            <div className="editor-header">
              <Button
                title="Назад к разделам"
                onClick={handleBackToSections}
                type="default"
                icon={<ArrowLeftOutlined />}
                disabled={loading}
              >
                Назад к разделам
              </Button>
            </div>
            <div className="editor-content">
              {activeTemplate && (
                <ExcelEditor
                  templateId={activeTemplate.id}
                  section={selectedSection.id}
                  onDataChange={handleDataChange}
                />
              )}
            </div>
          </div>
        ) : selectedSection?.id === 'accreditation' ? (
          <div className="editor-container">
            <div className="editor-header">
              <Button
                title="Назад к разделам"
                onClick={handleBackToSections}
                type="default"
                icon={<ArrowLeftOutlined />}
                disabled={loading}
              >
                Назад к разделам
              </Button>
            </div>
            <div className="editor-content">
              {loading ? (
                <div className="loading-state">
                  <Spin size="large" />
                </div>
              ) : (
                <div className="accreditation-section">
                  <div className="accreditation-card">
                    <div className="card-header">
                      <NumberOutlined className="card-icon" />
                      <span>Расположение в документе</span>
                    </div>
                    <div className="form-group">
                      <label>Номер строки</label>
                      <Input
                        type="number"
                        min="1"
                        value={accreditationHeaderRow}
                        onChange={e => setAccreditationHeaderRow(e.target.value)}
                        placeholder="Введите номер строки"
                        style={{ width: '200px' }}
                      />
                      <div className="hint-text">
                        <InfoCircleOutlined style={{ marginRight: '8px' }} />
                        Укажите номер строки, в которой находится информация об аккредитации
                        (учитывайте наличие меток разметки шаблона)
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default EditProtocolTemplateModal;
