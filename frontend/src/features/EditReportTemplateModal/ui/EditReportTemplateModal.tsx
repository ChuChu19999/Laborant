import { REPORT_TYPES } from '@/entities/Report';
import { Button } from '@/shared/ui/Button';
import { FormField } from '@/shared/ui/FormField';
import { Select } from '@/shared/ui/FormItems';
import {
  DeleteOutlined,
  EditOutlined,
  FileExcelOutlined,
  InboxOutlined,
  PlusOutlined,
} from '@/shared/ui/icons';
import { Modal } from '@/shared/ui/Modal';
import { Spin } from '@/shared/ui/Spin';
import { Upload } from '@/shared/ui/Upload';
import { useEditReportTemplateModal } from '../model/useEditReportTemplateModal';
import './EditReportTemplateModal.css';

const { Dragger } = Upload;
const { Option } = Select;

interface EditReportTemplateModalProps {
  open: boolean;
  onClose: () => void;
  laboratoryId: number;
  departmentId?: number;
}

const EditReportTemplateModal = ({
  open,
  onClose,
  laboratoryId,
  departmentId,
}: EditReportTemplateModalProps) => {
  const modal = useEditReportTemplateModal({ open, onClose, laboratoryId, departmentId });

  if (!open) return null;

  return (
    <Modal
      header={modal.isCreatingNew ? 'Добавление шаблона отчета' : 'Шаблоны отчетов'}
      onClose={modal.handleModalClose}
      onCancel={modal.handleModalClose}
      onSave={modal.shouldShowSaveButton ? modal.handleSave : undefined}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="1000"
    >
      <div className="edit-report-template-modal-content">
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
                  {template.report_type} - {template.version}
                </Option>
              ))}
            </Select>
          </div>
        )}

        {modal.isCreatingNew ? (
          <div className="new-template-form">
            {modal.loading ? (
              <div className="edit-report-template-loading-state">
                <Spin size="large" />
              </div>
            ) : (
              <>
                <FormField
                  label={
                    <>
                      Тип отчета <span className="form-label-required">*</span>
                    </>
                  }
                  labelClassName="edit-report-template-form-label"
                  itemClassName="edit-report-template-form-group"
                  error={
                    modal.errors.report_type ? (
                      <div className="form-error">{modal.errors.report_type}</div>
                    ) : undefined
                  }
                >
                  {fieldId => (
                    <Select
                      id={fieldId}
                      placeholder="Выберите тип отчета"
                      value={modal.selectedReportType || undefined}
                      onChange={value => modal.setReportType(value as string)}
                      className="report-type-select"
                      status={modal.errors.report_type ? 'error' : ''}
                    >
                      {REPORT_TYPES.map(type => (
                        <Option key={type} value={type}>
                          {type}
                        </Option>
                      ))}
                    </Select>
                  )}
                </FormField>

                <FormField
                  label={
                    <>
                      Файл шаблона <span className="form-label-required">*</span>
                    </>
                  }
                  labelClassName="edit-report-template-form-label"
                  itemClassName="edit-report-template-form-group"
                  labelMode="group"
                  error={
                    modal.errors.file ? (
                      <div className="form-error">{modal.errors.file}</div>
                    ) : undefined
                  }
                >
                  {(_fieldId, labelId) => (
                    <div
                      className="edit-report-template-upload-container"
                      aria-labelledby={labelId}
                    >
                      {modal.selectedFile ? (
                        <div className="selected-file">
                          <div className="edit-report-template-file-info">
                            <FileExcelOutlined className="file-icon" />
                            <span className="file-name">{modal.selectedFile.name}</span>
                          </div>
                          <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={modal.clearSelectedFile}
                            className="report-template-delete-button"
                            danger
                          />
                        </div>
                      ) : (
                        <Dragger
                          name="file"
                          multiple={false}
                          beforeUpload={modal.handleFileSelect}
                          showUploadList={false}
                          className="template-upload-dragger"
                        >
                          <p className="upload-drag-icon">
                            <InboxOutlined />
                          </p>
                          <p className="upload-text">Нажмите или перетащите файл для загрузки</p>
                          <p className="upload-hint">Поддерживаются файлы шаблонов отчетов</p>
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
            <p>Выберите шаблон для просмотра или добавьте новый</p>
          </div>
        ) : modal.templateLoading ? (
          <div className="edit-report-template-loading-state">
            <Spin size="large" />
          </div>
        ) : !modal.activeTemplate ? (
          <div className="no-template-message">
            <p>Шаблон не найден</p>
          </div>
        ) : (
          <div className="template-info">
            <div className="info-item">
              <span className="info-label">Тип отчета:</span>
              <span className="info-value">{modal.activeTemplate.report_type}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Версия:</span>
              <span className="info-value">{modal.activeTemplate.version}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Файл:</span>
              <div className="info-value-with-button">
                <span className="info-value">{modal.activeTemplate.file_name}</span>
                {!modal.isEditingFile && (
                  <Button
                    onClick={modal.startEditingFile}
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
            {modal.isEditingFile ? (
              <FormField
                label={
                  <>
                    Новый файл шаблона <span className="form-label-required">*</span>
                  </>
                }
                labelClassName="edit-report-template-form-label"
                itemClassName="edit-report-template-form-group edit-report-template-form-group-spaced"
                labelMode="group"
                error={
                  modal.errors.file ? (
                    <div className="form-error">{modal.errors.file}</div>
                  ) : undefined
                }
              >
                {(_fieldId, labelId) => (
                  <div className="edit-report-template-upload-container" aria-labelledby={labelId}>
                    {modal.selectedFile ? (
                      <div className="selected-file">
                        <div className="edit-report-template-file-info">
                          <FileExcelOutlined className="file-icon" />
                          <span className="file-name">{modal.selectedFile.name}</span>
                        </div>
                        <Button
                          type="text"
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={modal.clearSelectedFile}
                          className="report-template-delete-button"
                          danger
                        />
                      </div>
                    ) : (
                      <Dragger
                        name="file"
                        multiple={false}
                        beforeUpload={modal.handleFileSelect}
                        showUploadList={false}
                        className="template-upload-dragger"
                      >
                        <p className="upload-drag-icon">
                          <InboxOutlined />
                        </p>
                        <p className="upload-text">Нажмите или перетащите файл для загрузки</p>
                        <p className="upload-hint">Поддерживаются файлы шаблонов отчетов</p>
                      </Dragger>
                    )}
                  </div>
                )}
              </FormField>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default EditReportTemplateModal;
