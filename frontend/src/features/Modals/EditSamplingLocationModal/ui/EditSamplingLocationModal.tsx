import React, { useState, useEffect } from 'react';
import { useUpdateSamplingLocation } from '../../../../shared/model/hooks';
import { Input } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import type { SamplingLocation } from '../../../../shared/api/samplingLocations';
import './EditSamplingLocationModal.css';

interface EditSamplingLocationModalProps {
  open: boolean;
  location: SamplingLocation | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const EditSamplingLocationModal: React.FC<EditSamplingLocationModalProps> = ({
  open,
  location,
  onClose,
  onSuccess,
}) => {
  const updateSamplingLocationMutation = useUpdateSamplingLocation();
  const [formData, setFormData] = useState({
    name: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location && open) {
      setFormData({
        name: location.name || '',
      });
      setErrors({});
    }
  }, [location, open]);

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
      newErrors.name = 'Название места отбора пробы обязательно для заполнения';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!location?.id) {
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

      if (formData.name.trim() !== location.name) {
        updateData.name = formData.name.trim();
      }

      if (Object.keys(updateData).length > 0) {
        await updateSamplingLocationMutation.mutateAsync({ id: location.id, data: updateData });
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: unknown) {
      console.error('Ошибка при обновлении места отбора пробы:', error);
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
            general: 'Произошла ошибка при обновлении места отбора пробы',
          });
        }
      } else {
        setErrors({
          general: 'Произошла ошибка при обновлении места отбора пробы',
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

  if (!open || !location) return null;

  return (
    <div className="edit-sampling-location-modal-wrapper">
      <Modal
        header="Редактирование места отбора пробы"
        onClose={handleClose}
        onCancel={handleClose}
        onSave={handleSave}
        saveButtonText="Сохранить"
        showEditButton={false}
        editable={false}
        modalWidth="550"
      >
        <div className="edit-sampling-location-modal-content">
          <div className="edit-sampling-location-form-item">
            <label className="edit-sampling-location-label">
              Название места отбора пробы <span className="edit-sampling-location-required">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={handleInputChange('name')}
              placeholder="Введите название места отбора пробы"
              status={errors.name ? 'error' : ''}
              required
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EditSamplingLocationModal;
