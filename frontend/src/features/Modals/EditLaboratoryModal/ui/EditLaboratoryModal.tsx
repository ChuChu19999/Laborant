import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message, Input } from 'antd';
import {
  laboratoryApi,
  type LaboratoryUpdate,
  type LaboratoryResponse,
} from '../../../../shared/api/laboratory';
import Modal from '../../../../shared/ui/Modal/ui/Modal';
import './EditLaboratoryModal.css';

interface EditLaboratoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  laboratory: LaboratoryResponse | null;
}

const EditLaboratoryModal: React.FC<EditLaboratoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  laboratory,
}) => {
  const [name, setName] = useState('');
  const [fullName, setFullName] = useState('');
  const [laboratoryLocation, setLaboratoryLocation] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (laboratory && isOpen) {
      setName(laboratory.name || '');
      setFullName(laboratory.full_name || '');
      setLaboratoryLocation(laboratory.laboratory_location || '');
    }
  }, [laboratory, isOpen]);

  const updateMutation = useMutation({
    mutationFn: (data: LaboratoryUpdate) => laboratoryApi.updateLaboratory(laboratory!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laboratories'] });
      message.success('Лаборатория успешно обновлена');
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: unknown) => {
      console.error('Ошибка при обновлении лаборатории:', error);
      message.error('Не удалось обновить лабораторию');
    },
  });

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      message.warning('Введите аббревиатуру');
      return;
    }

    if (!fullName.trim()) {
      message.warning('Введите полное название');
      return;
    }

    if (!laboratory) {
      message.error('Лаборатория не выбрана');
      return;
    }

    const data: LaboratoryUpdate = {
      name: name.trim(),
      full_name: fullName.trim(),
      laboratory_location: laboratoryLocation.trim() || undefined,
    };

    updateMutation.mutate(data);
  }, [name, fullName, laboratoryLocation, laboratory, updateMutation]);

  const handleClose = useCallback(() => {
    if (!updateMutation.isPending) {
      setName('');
      setFullName('');
      setLaboratoryLocation('');
      onClose();
    }
  }, [updateMutation.isPending, onClose]);

  if (!isOpen || !laboratory) return null;

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
        header="Редактирование лаборатории"
        onClose={handleClose}
        onCancel={handleClose}
        onSave={handleSave}
        saveButtonText="Сохранить"
        showEditButton={false}
        editable={false}
        style={{ width: '550px' }}
      >
        <div className="edit-laboratory-form">
          <div className="form-group">
            <label>
              Аббревиатура <span style={{ color: 'red' }}>*</span>
            </label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Введите аббревиатуру"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleSave();
                }
              }}
            />
          </div>
          <div className="form-group">
            <label>
              Полное название <span style={{ color: 'red' }}>*</span>
            </label>
            <Input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Введите полное название"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleSave();
                }
              }}
            />
          </div>
          <div className="form-group">
            <label>Место осуществления лабораторной деятельности</label>
            <Input
              value={laboratoryLocation}
              onChange={e => setLaboratoryLocation(e.target.value)}
              placeholder="Введите место осуществления лабораторной деятельности (необязательно)"
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

export default EditLaboratoryModal;


