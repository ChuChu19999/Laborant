import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import { laboratoriesApi } from '../../../../shared/api/laboratories';
import { Input } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import './CreateLaboratoryModal.css';

interface CreateLaboratoryModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateLaboratoryModal: React.FC<CreateLaboratoryModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    full_name: '',
    laboratory_location: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData({
        name: '',
        full_name: '',
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
      newErrors.name = 'Аббревиатура обязательна для заполнения';
    }
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Полное название обязательно для заполнения';
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
      await laboratoriesApi.createLaboratory({
        name: formData.name.trim(),
        full_name: formData.full_name.trim(),
        laboratory_location: formData.laboratory_location.trim() || undefined,
      });

      message.success('Лаборатория успешно добавлена');
      setFormData({
        name: '',
        full_name: '',
        laboratory_location: '',
      });
      setErrors({});

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: unknown) {
      console.error('Ошибка при добавлении лаборатории:', error);
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
            message.error('Ошибка при добавлении лаборатории');
          }
        } else {
          message.error('Произошла ошибка при добавлении лаборатории');
        }
      } else {
        message.error('Произошла ошибка при добавлении лаборатории');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        name: '',
        full_name: '',
        laboratory_location: '',
      });
      setErrors({});
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="create-laboratory-modal-wrapper">
      <Modal
        header="Добавление лаборатории"
        onClose={handleClose}
        onCancel={handleClose}
        onSave={handleSave}
        saveButtonText="Сохранить"
        showEditButton={false}
        editable={false}
        modalWidth="550"
      >
        <div className="create-laboratory-modal-content">
          <div className="create-laboratory-form-item">
            <label className="create-laboratory-label">
              Аббревиатура <span className="create-laboratory-required">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={handleInputChange('name')}
              placeholder="Введите аббревиатуру"
              status={errors.name ? 'error' : ''}
              required
            />
          </div>
          <div className="create-laboratory-form-item">
            <label className="create-laboratory-label">
              Полное название <span className="create-laboratory-required">*</span>
            </label>
            <Input
              value={formData.full_name}
              onChange={handleInputChange('full_name')}
              placeholder="Введите полное название"
              status={errors.full_name ? 'error' : ''}
              required
            />
          </div>
          <div className="create-laboratory-form-item">
            <label className="create-laboratory-label">
              Место осуществления лабораторной деятельности
            </label>
            <Input
              value={formData.laboratory_location}
              onChange={handleInputChange('laboratory_location')}
              placeholder="Введите место осуществления (необязательно)"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CreateLaboratoryModal;
