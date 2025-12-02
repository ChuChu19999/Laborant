import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message, Input } from 'antd';
import {
  laboratoryApi,
  type DepartmentUpdate,
  type DepartmentResponse,
} from '../../../../shared/api/laboratory';
import Modal from '../../../../shared/ui/Modal/ui/Modal';
import './EditDepartmentModal.css';

interface EditDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  department: DepartmentResponse | null;
}

const EditDepartmentModal: React.FC<EditDepartmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  department,
}) => {
  const [name, setName] = useState('');
  const [laboratoryLocation, setLaboratoryLocation] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (department && isOpen) {
      setName(department.name || '');
      setLaboratoryLocation(department.laboratory_location || '');
    }
  }, [department, isOpen]);

  const updateMutation = useMutation({
    mutationFn: (data: DepartmentUpdate) =>
      laboratoryApi.updateDepartment(department!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['departments', department?.laboratory_id] });
      message.success('Подразделение успешно обновлено');
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: unknown) => {
      console.error('Ошибка при обновлении подразделения:', error);
      message.error('Не удалось обновить подразделение');
    },
  });

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      message.warning('Введите название подразделения');
      return;
    }

    if (!laboratoryLocation.trim()) {
      message.warning('Введите место осуществления лабораторной деятельности');
      return;
    }

    if (!department) {
      message.error('Подразделение не выбрано');
      return;
    }

    const data: DepartmentUpdate = {
      name: name.trim(),
      laboratory_location: laboratoryLocation.trim(),
    };

    updateMutation.mutate(data);
  }, [name, laboratoryLocation, department, updateMutation]);

  const handleClose = useCallback(() => {
    if (!updateMutation.isPending) {
      setName('');
      setLaboratoryLocation('');
      onClose();
    }
  }, [updateMutation.isPending, onClose]);

  if (!isOpen || !department) return null;

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
        header="Редактирование подразделения"
        onClose={handleClose}
        onCancel={handleClose}
        onSave={handleSave}
        saveButtonText="Сохранить"
        showEditButton={false}
        editable={false}
        style={{ width: '550px' }}
      >
        <div className="edit-department-form">
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
          <div className="form-group">
            <label>
              Место осуществления лабораторной деятельности <span style={{ color: 'red' }}>*</span>
            </label>
            <Input
              value={laboratoryLocation}
              onChange={e => setLaboratoryLocation(e.target.value)}
              placeholder="Введите место осуществления лабораторной деятельности"
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

export default EditDepartmentModal;


