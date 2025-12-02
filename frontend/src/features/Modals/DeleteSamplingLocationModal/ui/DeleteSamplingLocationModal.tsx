import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { laboratoryApi, type SamplingLocationResponse } from '../../../../shared/api/laboratory';
import Modal from '../../../../shared/ui/Modal/ui/Modal';
import './DeleteSamplingLocationModal.css';

interface DeleteSamplingLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  location: SamplingLocationResponse | null;
}

const DeleteSamplingLocationModal: React.FC<DeleteSamplingLocationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  location,
}) => {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: number) => laboratoryApi.deleteSamplingLocation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sampling-locations'] });
      message.success('Место отбора пробы успешно удалено');
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: unknown) => {
      console.error('Ошибка при удалении места отбора пробы:', error);
      message.error('Не удалось удалить место отбора пробы');
    },
  });

  const handleDelete = useCallback(() => {
    if (!location) {
      message.error('Место отбора пробы не выбрано');
      return;
    }

    deleteMutation.mutate(location.id);
  }, [location, deleteMutation]);

  const handleClose = useCallback(() => {
    if (!deleteMutation.isPending) {
      onClose();
    }
  }, [deleteMutation.isPending, onClose]);

  if (!isOpen || !location) return null;

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
        header="Удаление места отбора пробы"
        onClose={handleClose}
        onCancel={handleClose}
        onDelete={handleDelete}
        deleteTitle="Удалить"
        showEditButton={false}
        editable={false}
      >
        <div className="delete-sampling-location-confirmation">
          <div className="confirmation-content">
            <p className="confirmation-text">
              Вы действительно хотите удалить место отбора пробы &quot;{location.name}&quot;?
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default DeleteSamplingLocationModal;
