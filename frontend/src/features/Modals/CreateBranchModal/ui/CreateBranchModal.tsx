import React, { useState, useEffect } from 'react';
import { useCreateBranch } from '../../../../shared/model/hooks';
import { Input } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import './CreateBranchModal.css';

interface CreateBranchModalProps {
  open: boolean;
  laboratoryId: number;
  departmentId?: number;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateBranchModal: React.FC<CreateBranchModalProps> = ({
  open,
  laboratoryId,
  departmentId,
  onClose,
  onSuccess,
}) => {
  const createBranchMutation = useCreateBranch();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData({
        name: '',
        phone: '',
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
      await createBranchMutation.mutateAsync({
        name: formData.name.trim(),
        phone: formData.phone.trim() || undefined,
        laboratory_id: laboratoryId,
        department_id: departmentId,
      });

      setFormData({
        name: '',
        phone: '',
      });
      setErrors({});

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: unknown) {
      console.error('Ошибка при создании филиала:', error);
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
              general: 'Филиал с таким именем уже существует',
            });
          }
        } else {
          setErrors({
            general: 'Произошла ошибка при создании филиала',
          });
        }
      } else {
        setErrors({
          general: 'Произошла ошибка при создании филиала',
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
        phone: '',
      });
      setErrors({});
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="create-branch-modal-wrapper">
      <Modal
        header="Добавление филиала"
        onClose={handleClose}
        onCancel={handleClose}
        onSave={handleSave}
        saveButtonText="Сохранить"
        showEditButton={false}
        editable={false}
        modalWidth="550"
      >
        <div className="create-branch-modal-content">
          <div className="create-branch-form-item">
            <label className="create-branch-label">
              Название филиала <span className="create-branch-required">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={handleInputChange('name')}
              placeholder="Введите название филиала"
              status={errors.name ? 'error' : ''}
              required
            />
            {errors.name && <div className="error-message">{errors.name}</div>}
          </div>
          <div className="create-branch-form-item">
            <label className="create-branch-label">Номер телефона</label>
            <Input
              value={formData.phone}
              onChange={handleInputChange('phone')}
              placeholder="Введите номер телефона (необязательно)"
            />
          </div>
          {errors.general && <div className="error-message general-error">{errors.general}</div>}
        </div>
      </Modal>
    </div>
  );
};

export default CreateBranchModal;
