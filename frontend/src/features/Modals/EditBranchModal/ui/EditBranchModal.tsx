import React, { useState, useEffect } from 'react';
import { useUpdateBranch } from '../../../../shared/model/hooks';
import { Input } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import type { Branch } from '../../../../shared/api/samplingLocations';
import './EditBranchModal.css';

interface EditBranchModalProps {
  open: boolean;
  branch: Branch | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const EditBranchModal: React.FC<EditBranchModalProps> = ({ open, branch, onClose, onSuccess }) => {
  const updateBranchMutation = useUpdateBranch();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (branch && open) {
      setFormData({
        name: branch.name || '',
        phone: branch.phone || '',
      });
      setErrors({});
    }
  }, [branch, open]);

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
      newErrors.name = 'Название филиала обязательно для заполнения';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!branch?.id) {
      return;
    }

    if (!validate()) {
      return;
    }

    try {
      setLoading(true);
      const updateData: {
        name?: string;
        phone?: string;
      } = {};

      if (formData.name.trim() !== branch.name) {
        updateData.name = formData.name.trim();
      }
      if (formData.phone.trim() !== (branch.phone || '')) {
        updateData.phone = formData.phone.trim() || undefined;
      }

      if (Object.keys(updateData).length > 0) {
        await updateBranchMutation.mutateAsync({ id: branch.id, data: updateData });
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: unknown) {
      console.error('Ошибка при обновлении филиала:', error);
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
            general: 'Произошла ошибка при обновлении филиала',
          });
        }
      } else {
        setErrors({
          general: 'Произошла ошибка при обновлении филиала',
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

  if (!open || !branch) return null;

  return (
    <Modal
      header="Редактирование филиала"
      onClose={handleClose}
      onCancel={handleClose}
      onSave={handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="550"
    >
      <div className="edit-branch-modal-content">
        <div className="edit-branch-form-item">
          <label className="edit-branch-label">
            Название филиала <span className="edit-branch-required">*</span>
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
        <div className="edit-branch-form-item">
          <label className="edit-branch-label">Телефон</label>
          <Input
            value={formData.phone}
            onChange={handleInputChange('phone')}
            placeholder="Введите телефон (необязательно)"
          />
        </div>
        {errors.general && <div className="error-message general-error">{errors.general}</div>}
      </div>
    </Modal>
  );
};

export default EditBranchModal;
