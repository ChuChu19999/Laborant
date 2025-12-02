import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message, Input } from 'antd';
import {
  laboratoryApi,
  type BranchCreate,
  type LaboratoryResponse,
  type DepartmentResponse,
} from '../../../../shared/api/laboratory';
import Modal from '../../../../shared/ui/Modal/ui/Modal';
import './CreateBranchModal.css';

interface CreateBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (data: {
    name: string;
    phone?: string;
    laboratory_id: number;
    department_id?: number;
  }) => void;
  laboratory: LaboratoryResponse | null;
  department: DepartmentResponse | null;
}

const CreateBranchModal: React.FC<CreateBranchModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  laboratory,
  department,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: BranchCreate) => laboratoryApi.createBranch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      message.success('Филиал успешно создан');
      setName('');
      setPhone('');
      onClose();
    },
    onError: (error: unknown) => {
      console.error('Ошибка при создании филиала:', error);
      message.error('Не удалось создать филиал');
    },
  });

  useEffect(() => {
    if (isOpen) {
      setName('');
      setPhone('');
    }
  }, [isOpen]);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      message.warning('Введите название филиала');
      return;
    }

    if (!laboratory) {
      message.error('Лаборатория не выбрана');
      return;
    }

    const data = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      laboratory_id: laboratory.id,
      department_id: department?.id,
    };

    if (onSuccess) {
      onSuccess(data);
    } else {
      createMutation.mutate(data);
    }
  }, [name, phone, laboratory, department, createMutation, onSuccess]);

  const handleClose = useCallback(() => {
    if (!createMutation.isPending) {
      setName('');
      setPhone('');
      onClose();
    }
  }, [createMutation.isPending, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={handleClose} />
      <div className="modal-wrapper-custom">
        <Modal
          header="Создание филиала"
          onClose={handleClose}
          onCancel={handleClose}
          onSave={handleSave}
          saveButtonText="Создать"
          showEditButton={false}
          editable={false}
        >
          <div className="create-branch-form">
            <div className="form-group">
              <label>
                Название филиала <span style={{ color: 'red' }}>*</span>
              </label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Введите название филиала"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleSave();
                  }
                }}
              />
            </div>
            <div className="form-group">
              <label>Номер телефона</label>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Введите номер телефона (необязательно)"
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

export default CreateBranchModal;
