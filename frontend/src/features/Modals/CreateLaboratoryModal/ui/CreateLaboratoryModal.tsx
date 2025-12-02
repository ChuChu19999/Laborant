import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message, Input } from 'antd';
import { laboratoryApi } from '../../../../shared/api/laboratory';
import Modal from '../../../../shared/ui/Modal/ui/Modal';
import './CreateLaboratoryModal.css';

interface CreateLaboratoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateLaboratoryModal: React.FC<CreateLaboratoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: { name: string }) => laboratoryApi.createLaboratory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laboratories'] });
      message.success('Лаборатория успешно создана');
      setName('');
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: unknown) => {
      console.error('Ошибка при создании лаборатории:', error);
      message.error('Не удалось создать лабораторию');
    },
  });

  useEffect(() => {
    if (isOpen) {
      setName('');
    }
  }, [isOpen]);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      message.warning('Введите название лаборатории');
      return;
    }

    createMutation.mutate({ name: name.trim() });
  }, [name, createMutation]);

  const handleClose = useCallback(() => {
    if (!createMutation.isPending) {
      setName('');
      onClose();
    }
  }, [createMutation.isPending, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={handleClose} />
      <div className="modal-wrapper-custom">
        <Modal
          header="Добавить лабораторию"
          onClose={handleClose}
          onCancel={handleClose}
          onSave={handleSave}
          saveButtonText="Создать"
          showEditButton={false}
          editable={false}
        >
          <div className="create-laboratory-form">
            <div className="form-group">
              <label>
                Название лаборатории <span style={{ color: 'red' }}>*</span>
              </label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Введите название лаборатории"
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

export default CreateLaboratoryModal;
