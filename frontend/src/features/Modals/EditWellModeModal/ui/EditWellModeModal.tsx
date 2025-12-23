import React, { useState, useEffect } from 'react';
import { useUpdateWellMode } from '../../../../shared/model/hooks';
import { Input } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import type { WellMode } from '../../../../shared/api/samplingLocations';
import './EditWellModeModal.css';

interface EditWellModeModalProps {
  open: boolean;
  wellMode: WellMode | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const EditWellModeModal: React.FC<EditWellModeModalProps> = ({
  open,
  wellMode,
  onClose,
  onSuccess,
}) => {
  const updateWellModeMutation = useUpdateWellMode();
  const [formData, setFormData] = useState({
    name: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (wellMode && open) {
      setFormData({
        name: wellMode.name || '',
      });
      setErrors({});
    }
  }, [wellMode, open]);

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
      newErrors.name = 'Название режима скважины обязательно для заполнения';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!wellMode?.id) {
      return;
    }

    if (!validate()) {
      return;
    }

    try {
      setLoading(true);
      const updateData: {
        name?: string;
      } = {};

      if (formData.name.trim() !== wellMode.name) {
        updateData.name = formData.name.trim();
      }

      if (Object.keys(updateData).length > 0) {
        await updateWellModeMutation.mutateAsync({ id: wellMode.id, data: updateData });
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: unknown) {
      console.error('Ошибка при обновлении режима скважины:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: unknown } };
        if (axiosError.response?.data) {
          const errorData = axiosError.response.data as Record<string, unknown>;
          if (errorData.name && Array.isArray(errorData.name)) {
            setErrors({
              name: (errorData.name[0] as string) || 'Ошибка валидации',
            });
          } else if (errorData.detail) {
            setErrors({
              general: String(errorData.detail),
            });
          } else {
            setErrors({
              general: 'Ошибка валидации данных',
            });
          }
        } else {
          setErrors({
            general: 'Произошла ошибка при обновлении режима скважины',
          });
        }
      } else {
        setErrors({
          general: 'Произошла ошибка при обновлении режима скважины',
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
      });
      setErrors({});
      onClose();
    }
  };

  if (!open || !wellMode) return null;

  return (
    <div className="edit-well-mode-modal-wrapper">
      <Modal
        header="Редактирование режима скважины"
        onClose={handleClose}
        onCancel={handleClose}
        onSave={handleSave}
        saveButtonText="Сохранить"
        showEditButton={false}
        editable={false}
        modalWidth="550"
      >
        <div className="edit-well-mode-modal-content">
          <div className="edit-well-mode-form-item">
            <label className="edit-well-mode-label">
              Название режима скважины <span className="edit-well-mode-required">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={handleInputChange('name')}
              placeholder="Введите название режима скважины"
              status={errors.name ? 'error' : ''}
              required
            />
            {errors.name && <div className="error-message">{errors.name}</div>}
          </div>
          {errors.general && <div className="error-message general-error">{errors.general}</div>}
        </div>
      </Modal>
    </div>
  );
};

export default EditWellModeModal;
