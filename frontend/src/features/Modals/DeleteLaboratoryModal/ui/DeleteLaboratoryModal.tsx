import React, { useState } from 'react';
import { message } from 'antd';
import { laboratoriesApi, type Laboratory } from '../../../../shared/api/laboratories';
import { Modal } from '../../../../shared/ui/Modal';
import './DeleteLaboratoryModal.css';

interface DeleteLaboratoryModalProps {
  open: boolean;
  laboratory: Laboratory | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const DeleteLaboratoryModal: React.FC<DeleteLaboratoryModalProps> = ({
  open,
  laboratory,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (loading) return;

    if (!laboratory?.id) {
      message.error('Ошибка: лаборатория не найдена');
      return;
    }

    try {
      setLoading(true);
      await laboratoriesApi.deleteLaboratory(laboratory.id);

      message.success('Лаборатория успешно удалена');
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: unknown) {
      console.error('Ошибка при удалении лаборатории:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          message.error('Лаборатория не найдена');
        } else if (axiosError.response?.status === 403) {
          message.error('У вас нет прав на удаление этой лаборатории');
        } else {
          message.error('Произошла ошибка при удалении лаборатории');
        }
      } else {
        message.error('Произошла ошибка при удалении лаборатории');
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

  if (!open || !laboratory) return null;

  return (
    <>
      <div className="delete-laboratory-modal-overlay" />
      <div className="delete-laboratory-modal-wrapper">
        <Modal
          header="Удаление лаборатории"
          onClose={handleClose}
          onCancel={handleClose}
          onSave={handleDelete}
          saveButtonText="Сохранить"
          showEditButton={false}
          editable={false}
          style={{ width: '450px', zIndex: 1000 }}
        >
          <div className="delete-laboratory-modal-content">
            <p>Вы действительно хотите удалить лабораторию &quot;{laboratory.name}&quot;?</p>
          </div>
        </Modal>
      </div>
    </>
  );
};

export default DeleteLaboratoryModal;
