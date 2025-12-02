import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message, Input } from 'antd';
import {
  laboratoryApi,
  type SamplingLocationCreate,
  type BranchResponse,
} from '../../../../shared/api/laboratory';
import Modal from '../../../../shared/ui/Modal/ui/Modal';
import './CreateSamplingLocationModal.css';

interface CreateSamplingLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (data: { name: string; branch_id: number }) => void;
  branch: BranchResponse | null;
}

const CreateSamplingLocationModal: React.FC<CreateSamplingLocationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  branch,
}) => {
  const [name, setName] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: SamplingLocationCreate) => laboratoryApi.createSamplingLocation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sampling-locations'] });
      message.success('Место отбора пробы успешно создано');
      setName('');
      onClose();
    },
    onError: (error: unknown) => {
      console.error('Ошибка при создании места отбора пробы:', error);
      message.error('Не удалось создать место отбора пробы');
    },
  });

  useEffect(() => {
    if (isOpen) {
      setName('');
    }
  }, [isOpen]);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      message.warning('Введите название места отбора пробы');
      return;
    }

    if (!branch) {
      message.error('Филиал не выбран');
      return;
    }

    const data = {
      name: name.trim(),
      branch_id: branch.id,
    };

    if (onSuccess) {
      onSuccess(data);
    } else {
      createMutation.mutate(data);
    }
  }, [name, branch, createMutation, onSuccess]);

  const handleClose = useCallback(() => {
    if (!createMutation.isPending) {
      setName('');
      onClose();
    }
  }, [createMutation.isPending, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
        }}
      />
      <Modal
        header="Создание места отбора пробы"
        onClose={handleClose}
        onCancel={handleClose}
        onSave={handleSave}
        saveButtonText="Создать"
        showEditButton={false}
        editable={false}
      >
        <div className="create-sampling-location-form">
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
    </>
  );
};

export default CreateSamplingLocationModal;
