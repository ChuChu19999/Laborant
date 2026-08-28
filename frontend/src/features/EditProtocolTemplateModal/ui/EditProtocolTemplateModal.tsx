import { ExcelEditor } from '@/entities/Protocol';
import { Button } from '@/shared/ui/Button';
import { FormField } from '@/shared/ui/FormField';
import { Input, Select } from '@/shared/ui/FormItems';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  InboxOutlined,
  PlusOutlined,
} from '@/shared/ui/icons';
import { Modal } from '@/shared/ui/Modal';
import { Spin } from '@/shared/ui/Spin';
import { Upload } from '@/shared/ui/Upload';
import { useEditProtocolTemplateModal } from '../model/useEditProtocolTemplateModal';
import type { ReactNode } from 'react';
import './EditProtocolTemplateModal.css';

const { Dragger } = Upload;
const { Option } = Select;

const SECTION_ICONS: Record<string, ReactNode> = {
  header: <FileTextOutlined />,
};

interface EditProtocolTemplateModalProps {
  open: boolean;
  onClose: () => void;
  laboratoryId: number;
  departmentId?: number;
}

const EditProtocolTemplateModal = ({
  open,
  onClose,
  laboratoryId,
  departmentId,
}: EditProtocolTemplateModalProps) => {
  const modal = useEditProtocolTemplateModal({ open, onClose, laboratoryId, departmentId });

  if (!open) return null;

  return (
    <Modal
      header={modal.isCreatingNew ? 'Добавление шаблона протокола' : 'Редактирование шаблона'}
      onClose={modal.handleModalClose}
      onCancel={modal.handleModalClose}
      onSave={modal.handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="1000"
    >
      <div className="edit-protocol-template-modal-content">
        {!modal.isCreatingNew && (
          <div className="template-select-section">
            <Select
              placeholder="Выберите шаблон"
              onChange={modal.handleTemplateChange}
              value={modal.selectedTemplateId || undefined}
              className="template-select"
              style={{ width: '100%' }}
              loading={modal.templatesLoading}
              popupRender={menu => (
                <>
                  {menu}
                  <div className="select-dropdown-divider" />
                  <button
                    type="button"
                    className="select-dropdown-item"
                    onClick={() => modal.handleTemplateChange('new')}
                  >
                    <PlusOutlined /> Добавить новый шаблон
                  </button>
                </>
              )}
            >
              {modal.templates.map(template => (
                <Option key={template.id} value={template.id}>
                  {template.name} - {template.version}
                </Option>
              ))}
            </Select>
          </div>
        )}

        {modal.isCreatingNew ? (
          <div className="new-template-form">
            {modal.loading ? (
              <div className="edit-protocol-template-loading-state">
                <Spin size="large" />
              </div>
            ) : (
              <>
                <FormField
                  label={
                    <>
                      Название шаблона <span className="form-label-required">*</span>
                    </>
                  }
                  labelClassName="edit-protocol-template-form-label"
                  itemClassName="edit-protocol-template-form-group"
                  error={
                    modal.errors.name ? (
                      <div className="form-error">{modal.errors.name}</div>
                    ) : undefined
                  }
                >
                  {fieldId => (
                    <Input
                      id={fieldId}
                      placeholder="Введите название шаблона"
                      value={modal.newTemplateName}
                      onChange={e => modal.updateNewTemplateName(e.target.value)}
                      className="template-name-input"
                      status={modal.errors.name ? 'error' : ''}
                    />
                  )}
                </FormField>

                <FormField
                  label={
                    <>
                      Файл шаблона <span className="form-label-required">*</span>
                    </>
                  }
                  labelClassName="edit-protocol-template-form-label"
                  itemClassName="edit-protocol-template-form-group"
                  labelMode="group"
                >
                  {(_fieldId, labelId) => (
                    <div
                      className="edit-protocol-template-upload-container"
                      aria-labelledby={labelId}
                    >
                      {modal.selectedFile ? (
                        <div className="selected-file">
                          <div className="edit-protocol-template-file-info">
                            <FileExcelOutlined className="file-icon" />
                            <span className="file-name">{modal.selectedFile.name}</span>
                          </div>
                          <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={modal.clearSelectedFile}
                            className="protocol-template-delete-button"
                            danger
                          />
                        </div>
                      ) : (
                        <Dragger
                          name="file"
                          multiple={false}
                          accept=".xlsx"
                          beforeUpload={modal.handleFileSelect}
                          showUploadList={false}
                          className="template-upload-dragger"
                        >
                          <p className="upload-drag-icon">
                            <InboxOutlined />
                          </p>
                          <p className="upload-text">Нажмите или перетащите файл для загрузки</p>
                          <p className="upload-hint">Поддерживаются только файлы формата .xlsx</p>
                        </Dragger>
                      )}
                    </div>
                  )}
                </FormField>
              </>
            )}
          </div>
        ) : !modal.selectedTemplateId ? (
          <div className="select-template-message">
            <p>Выберите шаблон для редактирования или добавьте новый</p>
          </div>
        ) : modal.templateLoading ? (
          <div className="edit-protocol-template-loading-state">
            <Spin size="large" />
          </div>
        ) : !modal.activeTemplate ? (
          <div className="no-template-message">
            <p>Шаблон не найден</p>
          </div>
        ) : !modal.selectedSection ? (
          <div className="sections-list">
            {modal.sections.map(section => (
              <button
                type="button"
                key={section.id}
                className="section-item"
                onClick={() => modal.handleSectionSelect(section)}
              >
                <span className="section-icon">{SECTION_ICONS[section.id]}</span>
                <div className="section-info">
                  <div className="section-name">{section.name}</div>
                  <div className="section-description">{section.description}</div>
                </div>
                <span className="section-arrow">{'>'}</span>
              </button>
            ))}
          </div>
        ) : modal.selectedSection?.id === 'header' ? (
          <div className="editor-container">
            <div className="editor-header">
              <Button
                title="Назад к разделам"
                onClick={modal.handleBackToSections}
                type="default"
                icon={<ArrowLeftOutlined />}
                disabled={modal.loading}
                className="editor-back-button"
              >
                Назад к разделам
              </Button>
            </div>
            <div className="editor-content">
              <ExcelEditor
                key={modal.activeTemplate.id}
                templateId={modal.activeTemplate.id}
                section={modal.selectedSection.id}
                onDataChange={modal.handleDataChange}
              />
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default EditProtocolTemplateModal;
