import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message, Input } from 'antd';
import { laboratoryApi } from '../../../../shared/api/laboratory';
import Modal from '../../../../shared/ui/Modal/ui/Modal';
import './CreateDepartmentModal.css';

interface CreateDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  laboratoryId: number;
}

const CreateDepartmentModal: React.FC<CreateDepartmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  laboratoryId,
}) => {
  const [name, setName] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: { name: string; laboratory_id: number }) =>
      laboratoryApi.createDepartment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['departments', laboratoryId] });
      message.success('Подразделение успешно создано');
      setName('');
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: unknown) => {
      console.error('Ошибка при создании подразделения:', error);
      message.error('Не удалось создать подразделение');
    },
  });

  useEffect(() => {
    if (isOpen) {
      setName('');
    }
  }, [isOpen]);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      message.warning('Введите название подразделения');
      return;
    }

    createMutation.mutate({ name: name.trim(), laboratory_id: laboratoryId });
  }, [name, laboratoryId, createMutation]);

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
          header="Добавить подразделение"
          onClose={handleClose}
          onCancel={handleClose}
          onSave={handleSave}
          saveButtonText="Создать"
          showEditButton={false}
          editable={false}
        >
          <div className="create-department-form">
            <div className="form-group">
              <label>
                Название подразделения <span style={{ color: 'red' }}>*</span>
              </label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Введите название подразделения"
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

export default CreateDepartmentModal;
