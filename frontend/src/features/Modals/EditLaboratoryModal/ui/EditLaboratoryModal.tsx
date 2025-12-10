import React, { useState, useEffect } from 'react';
import { Input, message } from 'antd';
import { laboratoriesApi, type Laboratory } from '../../../../shared/api/laboratories';
import { Modal } from '../../../../shared/ui/Modal';
import './EditLaboratoryModal.css';

interface EditLaboratoryModalProps {
  open: boolean;
  laboratory: Laboratory | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const EditLaboratoryModal: React.FC<EditLaboratoryModalProps> = ({
  open,
  laboratory,
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
    if (laboratory && open) {
      setFormData({
        name: laboratory.name || '',
        full_name: laboratory.full_name || '',
        laboratory_location: laboratory.laboratory_location || '',
      });
      setErrors({});
    }
  }, [laboratory, open]);

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
    if (!laboratory?.id) {
      message.error('Лаборатория не найдена');
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
        full_name?: string;
        laboratory_location?: string;
      } = {};

      if (formData.name.trim() !== laboratory.name) {
        updateData.name = formData.name.trim();
      }
      if (formData.full_name.trim() !== laboratory.full_name) {
        updateData.full_name = formData.full_name.trim();
      }
      if (formData.laboratory_location.trim() !== (laboratory.laboratory_location || '')) {
        updateData.laboratory_location = formData.laboratory_location.trim();
      }

      if (Object.keys(updateData).length > 0) {
        await laboratoriesApi.updateLaboratory(laboratory.id, updateData);
        message.success('Лаборатория успешно обновлена');
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: unknown) {
      console.error('Ошибка при обновлении лаборатории:', error);
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
          message.error('Произошла ошибка при обновлении лаборатории');
        }
      } else {
        message.error('Произошла ошибка при обновлении лаборатории');
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

  if (!open || !laboratory) return null;

  return (
    <div className="edit-laboratory-modal-wrapper">
      <Modal
        header="Редактирование лаборатории"
        onClose={handleClose}
        onCancel={handleClose}
        onSave={handleSave}
        saveButtonText="Сохранить"
        showEditButton={false}
        editable={false}
        modalWidth="550"
      >
        <div className="edit-laboratory-modal-content">
          <div className="edit-laboratory-form-item">
            <label className="edit-laboratory-label">
              Аббревиатура <span className="edit-laboratory-required">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={handleInputChange('name')}
              placeholder="Введите аббревиатуру"
              status={errors.name ? 'error' : ''}
              required
            />
            {errors.name && <div className="error-message">{errors.name}</div>}
          </div>
          <div className="edit-laboratory-form-item">
            <label className="edit-laboratory-label">
              Полное название <span className="edit-laboratory-required">*</span>
            </label>
            <Input
              value={formData.full_name}
              onChange={handleInputChange('full_name')}
              placeholder="Введите полное название"
              status={errors.full_name ? 'error' : ''}
              required
            />
            {errors.full_name && <div className="error-message">{errors.full_name}</div>}
          </div>
          <div className="edit-laboratory-form-item">
            <label className="edit-laboratory-label">
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

export default EditLaboratoryModal;
