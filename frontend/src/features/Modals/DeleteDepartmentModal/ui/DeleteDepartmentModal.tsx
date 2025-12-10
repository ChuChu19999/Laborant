import React, { useState } from 'react';
import { message } from 'antd';
import { laboratoriesApi, type Department } from '../../../../shared/api/laboratories';
import { Modal } from '../../../../shared/ui/Modal';
import './DeleteDepartmentModal.css';

interface DeleteDepartmentModalProps {
  open: boolean;
  department: Department | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const DeleteDepartmentModal: React.FC<DeleteDepartmentModalProps> = ({
  open,
  department,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (loading) return;

    if (!department?.id) {
      message.error('Ошибка: подразделение не найдено');
      return;
    }

    try {
      setLoading(true);
      await laboratoriesApi.deleteDepartment(department.id);

      message.success('Подразделение успешно удалено');
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: unknown) {
      console.error('Ошибка при удалении подразделения:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          message.error('Подразделение не найдено');
        } else if (axiosError.response?.status === 403) {
          message.error('У вас нет прав на удаление этого подразделения');
        } else {
          message.error('Произошла ошибка при удалении подразделения');
        }
      } else {
        message.error('Произошла ошибка при удалении подразделения');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  if (!open || !department) return null;

  return (
    <div className="delete-department-modal-wrapper">
      <Modal
        header="Удаление подразделения"
        onClose={handleClose}
        onCancel={handleClose}
        onSave={handleDelete}
        saveButtonText="Сохранить"
        showEditButton={false}
        editable={false}
        modalWidth="450"
      >
        <div className="delete-department-modal-content">
          <p>Вы действительно хотите удалить подразделение &quot;{department.name}&quot;?</p>
        </div>
      </Modal>
    </div>
  );
};

export default DeleteDepartmentModal;
