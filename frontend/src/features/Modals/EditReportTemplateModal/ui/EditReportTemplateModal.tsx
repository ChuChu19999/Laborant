import React, { useCallback, useEffect, useState } from 'react';
import {
  DeleteOutlined,
  EditOutlined,
  FileExcelOutlined,
  InboxOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { message, Spin, Upload } from 'antd';
import { reportsApi, type ReportTemplate, REPORT_TYPES } from '../../../../shared/api/reports';
import { useAutoRefetchQuery } from '../../../../shared/model/lib/useQuery';
import Button from '../../../../shared/ui/Button/Button';
import { Select } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import './EditReportTemplateModal.css';

const { Dragger } = Upload;
const { Option } = Select;

interface EditReportTemplateModalProps {
  open: boolean;
  onClose: () => void;
  laboratoryId: number;
  departmentId?: number;
}

const EditReportTemplateModal: React.FC<EditReportTemplateModalProps> = ({
  open,
  onClose,
  laboratoryId,
  departmentId,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<ReportTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isEditingFile, setIsEditingFile] = useState(false);

  // Загрузка списка шаблонов
  const {
    data: templatesData,
    isLoading: templatesLoading,
    refetch: refetchTemplates,
  } = useAutoRefetchQuery(
    ['report-templates', laboratoryId, departmentId],
    () => reportsApi.getReportTemplates(laboratoryId, departmentId),
    {
      enabled: open && !!laboratoryId,
    }
  );

  const templates = templatesData?.items.filter(t => !t.deleted_at) || [];

  // Загрузка активного шаблона
  const { data: templateData, isLoading: templateLoading } = useAutoRefetchQuery(
    ['report-template', selectedTemplateId],
    () => reportsApi.getReportTemplate(selectedTemplateId!),
    {
      enabled: open && !!selectedTemplateId,
    }
  );

  useEffect(() => {
    if (templateData) {
      setActiveTemplate(templateData);
      setSelectedReportType(templateData.report_type);
    }
  }, [templateData]);

  useEffect(() => {
    if (!open) {
      // Сброс состояния при закрытии
      setSelectedTemplateId(null);
      setActiveTemplate(null);
      setIsCreatingNew(false);
      setSelectedReportType('');
      setSelectedFile(null);
      setErrors({});
      setIsEditingFile(false);
    }
  }, [open]);

  const handleTemplateChange = useCallback((value: unknown) => {
    if (value === 'new') {
      setIsCreatingNew(true);
      setSelectedTemplateId(null);
      setActiveTemplate(null);
      setSelectedReportType('');
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
        // Убираем префикс data:application/octet-stream;base64, или другой
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleCreateNewTemplate = useCallback(async () => {
    if (!selectedReportType) {
      setErrors(prev => ({ ...prev, report_type: 'Выберите тип отчета' }));
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
        report_type: selectedReportType,
        file_name: selectedFile.name,
        file: fileBase64,
        laboratory_id: laboratoryId,
        department_id: departmentId,
      };

      const createdTemplate = await reportsApi.createReportTemplate(templateData);
      setActiveTemplate(createdTemplate);
      setSelectedTemplateId(createdTemplate.id);
      setIsCreatingNew(false);
      setSelectedReportType('');
      setSelectedFile(null);
      message.success('Шаблон успешно добавлен');
      refetchTemplates();
    } catch (error) {
      console.error('Ошибка при добавлении шаблона:', error);
      message.error('Ошибка при добавлении шаблона');
    } finally {
      setLoading(false);
    }
  }, [selectedReportType, selectedFile, laboratoryId, departmentId, refetchTemplates]);

  const handleUpdateTemplateFile = useCallback(async () => {
    if (!activeTemplate || !selectedFile) {
      message.error('Выберите файл для загрузки');
      return;
    }

    try {
      setLoading(true);
      const fileBase64 = await fileToBase64(selectedFile);

      const updatedTemplate = await reportsApi.updateReportTemplate(activeTemplate.id, {
        file: fileBase64,
        file_name: selectedFile.name,
      });

      setActiveTemplate(updatedTemplate);
      setSelectedTemplateId(updatedTemplate.id);
      setSelectedFile(null);
      setIsEditingFile(false);
      message.success('Шаблон успешно обновлен');
      refetchTemplates();
    } catch (error) {
      console.error('Ошибка при обновлении шаблона:', error);
      message.error('Ошибка при обновлении шаблона');
    } finally {
      setLoading(false);
    }
  }, [activeTemplate, selectedFile, refetchTemplates]);

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

      // Если загружается новый файл
      if (isEditingFile && selectedFile) {
        await handleUpdateTemplateFile();
        return;
      }

      message.info('Нет изменений для сохранения');
    } catch (error) {
      console.error('Ошибка при сохранении:', error);
      message.error('Ошибка при сохранении изменений');
    } finally {
      setLoading(false);
    }
  }, [
    isCreatingNew,
    activeTemplate,
    isEditingFile,
    selectedFile,
    handleCreateNewTemplate,
    handleUpdateTemplateFile,
  ]);

  const handleModalClose = useCallback(() => {
    setSelectedTemplateId(null);
    setActiveTemplate(null);
    setIsCreatingNew(false);
    setSelectedReportType('');
    setSelectedFile(null);
    setErrors({});
    setIsEditingFile(false);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const shouldShowSaveButton = selectedFile !== null;

  return (
    <Modal
      header={isCreatingNew ? 'Добавление нового шаблона отчета' : 'Шаблоны отчетов'}
      onClose={handleModalClose}
      onCancel={handleModalClose}
      onSave={shouldShowSaveButton ? handleSave : undefined}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="1000"
    >
      <div className="edit-report-template-modal-content">
        {!isCreatingNew && (
          <div className="template-select-section">
            <Select
              placeholder="Выберите шаблон отчета"
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
                  {template.report_type} - {template.version}
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
                    Тип отчета <span className="form-label-required">*</span>
                  </label>
                  <Select
                    placeholder="Выберите тип отчета"
                    value={selectedReportType || undefined}
                    onChange={value => {
                      setSelectedReportType(value as string);
                      setErrors(prev => ({ ...prev, report_type: '' }));
                    }}
                    className="report-type-select"
                    status={errors.report_type ? 'error' : ''}
                  >
                    {REPORT_TYPES.map(type => (
                      <Option key={type} value={type}>
                        {type}
                      </Option>
                    ))}
                  </Select>
                  {errors.report_type && <div className="form-error">{errors.report_type}</div>}
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
                          className="report-template-delete-button"
                          danger
                        />
                      </div>
                    ) : (
                      <Dragger
                        name="file"
                        multiple={false}
                        beforeUpload={handleFileSelect}
                        showUploadList={false}
                      >
                        <p className="ant-upload-drag-icon">
                          <InboxOutlined />
                        </p>
                        <p className="ant-upload-text">Нажмите или перетащите файл для загрузки</p>
                        <p className="ant-upload-hint">Поддерживаются любые файлы</p>
                      </Dragger>
                    )}
                  </div>
                  {errors.file && <div className="form-error">{errors.file}</div>}
                </div>
              </>
            )}
          </div>
        ) : !selectedTemplateId ? (
          <div className="select-template-message">
            <p>Выберите шаблон для просмотра или добавьте новый</p>
          </div>
        ) : templateLoading ? (
          <div className="loading-state">
            <Spin size="large" />
          </div>
        ) : !activeTemplate ? (
          <div className="no-template-message">
            <p>Шаблон не найден</p>
          </div>
        ) : (
          <div className="template-info">
            <div className="info-item">
              <span className="info-label">Тип отчета:</span>
              <span className="info-value">{activeTemplate.report_type}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Версия:</span>
              <span className="info-value">{activeTemplate.version}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Файл:</span>
              <div className="info-value-with-button">
                <span className="info-value">{activeTemplate.file_name}</span>
                <div style={{ flex: 2.5 }} />
                {!isEditingFile && (
                  <Button
                    onClick={() => setIsEditingFile(true)}
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    className="report-template-edit-button"
                  >
                    Редактировать
                  </Button>
                )}
              </div>
            </div>
            {isEditingFile && (
              <div className="form-group" style={{ marginTop: 24 }}>
                <label className="form-label">
                  Новый файл шаблона <span className="form-label-required">*</span>
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
                        className="report-template-delete-button"
                        danger
                      />
                    </div>
                  ) : (
                    <Dragger
                      name="file"
                      multiple={false}
                      beforeUpload={handleFileSelect}
                      showUploadList={false}
                    >
                      <p className="ant-upload-drag-icon">
                        <InboxOutlined />
                      </p>
                      <p className="ant-upload-text">Нажмите или перетащите файл для загрузки</p>
                      <p className="ant-upload-hint">Поддерживаются любые файлы</p>
                    </Dragger>
                  )}
                </div>
                {errors.file && <div className="form-error">{errors.file}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default EditReportTemplateModal;
