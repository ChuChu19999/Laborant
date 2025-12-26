import React, { useState, useEffect } from 'react';
import { useCreateWellMode } from '../../../../shared/model/hooks';
import { Input } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import './CreateWellModeModal.css';

interface CreateWellModeModalProps {
  open: boolean;
  branchId: number;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateWellModeModal: React.FC<CreateWellModeModalProps> = ({
  open,
  branchId,
  onClose,
  onSuccess,
}) => {
  const createWellModeMutation = useCreateWellMode();
  const [formData, setFormData] = useState({
    name: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData({
        name: '',
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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    try {
      setLoading(true);
      await createWellModeMutation.mutateAsync({
        name: formData.name.trim(),
        branch_id: branchId,
      });

      setFormData({
        name: '',
      });
      setErrors({});

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: unknown) {
      console.error('Ошибка при добавлении режима скважины:', error);
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
              general: 'Режим скважины с таким именем уже существует',
            });
          }
        } else {
          setErrors({
            general: 'Произошла ошибка при добавлении режима скважины',
          });
        }
      } else {
        setErrors({
          general: 'Произошла ошибка при добавлении режима скважины',
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

  if (!open) return null;

  return (
    <div className="create-well-mode-modal-wrapper">
      <Modal
        header="Добавление режима скважины"
        onClose={handleClose}
        onCancel={handleClose}
        onSave={handleSave}
        saveButtonText="Сохранить"
        showEditButton={false}
        editable={false}
        modalWidth="550"
      >
        <div className="create-well-mode-modal-content">
          <div className="create-well-mode-form-item">
            <label className="create-well-mode-label">
              Название режима скважины <span className="create-well-mode-required">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={handleInputChange('name')}
              placeholder="Введите название режима скважины"
              status={errors.name ? 'error' : ''}
              required
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CreateWellModeModal;
