import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message, Input } from 'antd';
import {
  laboratoryApi,
  type BranchUpdate,
  type BranchResponse,
} from '../../../../shared/api/laboratory';
import Modal from '../../../../shared/ui/Modal/ui/Modal';
import './EditBranchModal.css';

interface EditBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  branch: BranchResponse | null;
}

const EditBranchModal: React.FC<EditBranchModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  branch,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (branch && isOpen) {
      setName(branch.name || '');
      setPhone(branch.phone || '');
    }
  }, [branch, isOpen]);

  const updateMutation = useMutation({
    mutationFn: (data: BranchUpdate) => laboratoryApi.updateBranch(branch!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      message.success('Филиал успешно обновлен');
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: unknown) => {
      console.error('Ошибка при обновлении филиала:', error);
      message.error('Не удалось обновить филиал');
    },
  });

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      message.warning('Введите название филиала');
      return;
    }

    if (!branch) {
      message.error('Филиал не выбран');
      return;
    }

    const data: BranchUpdate = {
      name: name.trim(),
      phone: phone.trim() || undefined,
    };

    updateMutation.mutate(data);
  }, [name, phone, branch, updateMutation]);

  const handleClose = useCallback(() => {
    if (!updateMutation.isPending) {
      setName('');
      setPhone('');
      onClose();
    }
  }, [updateMutation.isPending, onClose]);

  if (!isOpen || !branch) return null;

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
        header="Редактирование филиала"
        onClose={handleClose}
        onCancel={handleClose}
        onSave={handleSave}
        saveButtonText="Сохранить"
        showEditButton={false}
        editable={false}
      >
        <div className="edit-branch-form">
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
    </>
  );
};

export default EditBranchModal;
