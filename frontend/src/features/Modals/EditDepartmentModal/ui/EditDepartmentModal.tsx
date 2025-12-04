import React, { useState, useEffect } from 'react';
import { Input, message } from 'antd';
import { laboratoriesApi, type Department } from '../../../../shared/api/laboratories';
import { Modal } from '../../../../shared/ui/Modal';
import './EditDepartmentModal.css';

interface EditDepartmentModalProps {
  open: boolean;
  department: Department | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const EditDepartmentModal: React.FC<EditDepartmentModalProps> = ({
  open,
  department,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    laboratory_location: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (department && open) {
      setFormData({
        name: department.name || '',
        laboratory_location: department.laboratory_location || '',
      });
      setErrors({});
    }
  }, [department, open]);

  const handleInputChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value,
    }));
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Название подразделения обязательно для заполнения';
    }
    if (!formData.laboratory_location.trim()) {
      newErrors.laboratory_location =
        'Место осуществления лабораторной деятельности обязательно для заполнения';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!department?.id) {
      message.error('Подразделение не найдено');
      return;
    }

    if (!validate()) {
      message.error('Пожалуйста, заполните все обязательные поля');
      return;
    }

    try {
      setLoading(true);
      const updateData: {
        name?: string;
        laboratory_location?: string;
      } = {};

      if (formData.name.trim() !== department.name) {
        updateData.name = formData.name.trim();
      }
      if (formData.laboratory_location.trim() !== department.laboratory_location) {
        updateData.laboratory_location = formData.laboratory_location.trim();
      }

      if (Object.keys(updateData).length > 0) {
        await laboratoriesApi.updateDepartment(department.id, updateData);
        message.success('Подразделение успешно обновлено');
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: unknown) {
      console.error('Ошибка при обновлении подразделения:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: unknown } };
        if (axiosError.response?.data) {
          const errorData = axiosError.response.data as Record<string, unknown>;
          if (errorData.name && Array.isArray(errorData.name)) {
            setErrors({
              name: (errorData.name[0] as string) || 'Ошибка валидации',
            });
          } else if (errorData.detail) {
            message.error(String(errorData.detail));
          } else {
            message.error('Ошибка валидации данных');
          }
        } else {
          message.error('Произошла ошибка при обновлении подразделения');
        }
      } else {
        message.error('Произошла ошибка при обновлении подразделения');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        name: '',
        laboratory_location: '',
      });
      setErrors({});
      onClose();
    }
  };

  if (!open || !department) return null;

  return (
    <>
      <div className="edit-department-modal-overlay" />
      <div className="edit-department-modal-wrapper">
        <Modal
          header="Редактирование подразделения"
          onClose={handleClose}
          onCancel={handleClose}
          onSave={handleSave}
          saveButtonText="Сохранить"
          showEditButton={false}
          editable={false}
          style={{ width: '550px', zIndex: 1000 }}
        >
          <div className="edit-department-modal-content">
            <div className="edit-department-form-item">
              <label className="edit-department-label">
                Название подразделения <span className="edit-department-required">*</span>
              </label>
              <Input
                value={formData.name}
                onChange={handleInputChange('name')}
                placeholder="Введите название подразделения"
                status={errors.name ? 'error' : ''}
                required
              />
              {errors.name && <div className="error-message">{errors.name}</div>}
            </div>
            <div className="edit-department-form-item">
              <label className="edit-department-label">
                Место осуществления лабораторной деятельности{' '}
                <span className="edit-department-required">*</span>
              </label>
              <Input
                value={formData.laboratory_location}
                onChange={handleInputChange('laboratory_location')}
                placeholder="Введите место осуществления лабораторной деятельности"
                status={errors.laboratory_location ? 'error' : ''}
                required
              />
              {errors.laboratory_location && (
                <div className="error-message">{errors.laboratory_location}</div>
              )}
            </div>
            {errors.general && <div className="error-message general-error">{errors.general}</div>}
          </div>
        </Modal>
      </div>
    </>
  );
};

export default EditDepartmentModal;
