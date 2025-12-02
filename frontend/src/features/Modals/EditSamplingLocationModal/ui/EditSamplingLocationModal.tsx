import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message, Input } from 'antd';
import {
  laboratoryApi,
  type SamplingLocationUpdate,
  type SamplingLocationResponse,
} from '../../../../shared/api/laboratory';
import Modal from '../../../../shared/ui/Modal/ui/Modal';
import './EditSamplingLocationModal.css';

interface EditSamplingLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  location: SamplingLocationResponse | null;
}

const EditSamplingLocationModal: React.FC<EditSamplingLocationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  location,
}) => {
  const [name, setName] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (location && isOpen) {
      setName(location.name || '');
    }
  }, [location, isOpen]);

  const updateMutation = useMutation({
    mutationFn: (data: SamplingLocationUpdate) =>
      laboratoryApi.updateSamplingLocation(location!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sampling-locations'] });
      message.success('Место отбора пробы успешно обновлено');
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: unknown) => {
      console.error('Ошибка при обновлении места отбора пробы:', error);
      message.error('Не удалось обновить место отбора пробы');
    },
  });

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      message.warning('Введите название места отбора пробы');
      return;
    }

    if (!location) {
      message.error('Место отбора пробы не выбрано');
      return;
    }

    const data: SamplingLocationUpdate = {
      name: name.trim(),
    };

    updateMutation.mutate(data);
  }, [name, location, updateMutation]);

  const handleClose = useCallback(() => {
    if (!updateMutation.isPending) {
      setName('');
      onClose();
    }
  }, [updateMutation.isPending, onClose]);

  if (!isOpen || !location) return null;

  return (
    <>
      <div className="modal-overlay" onClick={handleClose} />
      <div className="modal-wrapper-custom">
        <Modal
          header="Редактирование места отбора пробы"
          onClose={handleClose}
          onCancel={handleClose}
          onSave={handleSave}
          saveButtonText="Сохранить"
          showEditButton={false}
          editable={false}
        >
          <div className="edit-sampling-location-form">
            <div className="form-group">
              <label>
                Название места отбора пробы <span style={{ color: 'red' }}>*</span>
              </label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Введите название места отбора пробы"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleSave();
                  }
                }}
              />
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
};

export default EditSamplingLocationModal;
