import React, { useState, useEffect } from 'react';
import { Input, message } from 'antd';
import { laboratoriesApi } from '../../../../shared/api/laboratories';
import { Modal } from '../../../../shared/ui/Modal';
import './CreateDepartmentModal.css';

interface CreateDepartmentModalProps {
  open: boolean;
  laboratoryId: number;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateDepartmentModal: React.FC<CreateDepartmentModalProps> = ({
  open,
  laboratoryId,
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
    if (open) {
      setFormData({
        name: '',
        laboratory_location: '',
      });
      setErrors({});
    }
  }, [open]);

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
      newErrors.name = 'Название обязательно';
    }
    if (!formData.laboratory_location.trim()) {
      newErrors.laboratory_location = 'Местоположение обязательно';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      message.error('Пожалуйста, заполните все обязательные поля');
      return;
    }

    try {
      setLoading(true);
      await laboratoriesApi.createDepartment({
        name: formData.name.trim(),
        laboratory_id: laboratoryId,
        laboratory_location: formData.laboratory_location.trim(),
      });

      message.success('Подразделение успешно создано');
      setFormData({
        name: '',
        laboratory_location: '',
      });
      setErrors({});

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: unknown) {
      console.error('Ошибка при создании подразделения:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: unknown } };
        if (axiosError.response?.data) {
          const errorData = axiosError.response.data as Record<string, unknown>;
          if (errorData.name && Array.isArray(errorData.name)) {
            const errorMessage = (errorData.name[0] as string) || 'Ошибка валидации';
            if (errorMessage.includes('уже существует')) {
              setErrors({
                name: errorMessage,
              });
            } else {
              setErrors({
                general: errorMessage,
              });
            }
          } else if (errorData.detail) {
            setErrors({
              general: String(errorData.detail),
            });
          } else {
            setErrors({
              general: 'Подразделение с таким именем уже существует',
            });
          }
        } else {
          setErrors({
            general: 'Произошла ошибка при создании подразделения',
          });
        }
      } else {
        setErrors({
          general: 'Произошла ошибка при создании подразделения',
        });
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

  if (!open) return null;

  return (
    <>
      <div className="create-department-modal-overlay" />
      <div className="create-department-modal-wrapper">
        <Modal
          header="Создание подразделения"
          onClose={handleClose}
          onCancel={handleClose}
          onSave={handleSave}
          saveButtonText="Сохранить"
          showEditButton={false}
          editable={false}
          style={{ width: '550px', zIndex: 1000 }}
        >
          <div className="create-department-modal-content">
            <div className="create-department-form-item">
              <label className="create-department-label">
                Название подразделения <span className="create-department-required">*</span>
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
            <div className="create-department-form-item">
              <label className="create-department-label">
                Место осуществления лабораторной деятельности{' '}
                <span className="create-department-required">*</span>
              </label>
              <Input
                value={formData.laboratory_location}
                onChange={handleInputChange('laboratory_location')}
                placeholder="Введите место осуществления"
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

export default CreateDepartmentModal;
