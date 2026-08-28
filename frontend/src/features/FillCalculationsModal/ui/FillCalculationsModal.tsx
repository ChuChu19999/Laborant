import { CalculationsTable } from '@/entities/Calculation';
import { Button } from '@/shared/ui/Button';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import { PlusOutlined } from '@/shared/ui/icons';
import { Modal } from '@/shared/ui/Modal';
import { useFillCalculationsModal } from '../model/useFillCalculationsModal';
import type { Sample } from '@/entities/Sample';
import './FillCalculationsModal.css';

export interface FillCalculationsModalProps {
  open: boolean;
  onClose: () => void;
  sample: Sample;
}

const FillCalculationsModal = ({ open, onClose, sample }: FillCalculationsModalProps) => {
  const modal = useFillCalculationsModal({ open, onClose, sample });

  if (!open) return null;

  return (
    <>
      <Modal
        header={`Расчёты для пробы ${sample.registration_number}`}
        onClose={modal.handleCancel}
        onCancel={modal.handleCancel}
        showEditButton={false}
        editable={false}
        modalWidth="1800"
        extraButtons={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={modal.handleAddCalculation}
            className="fill-calculations-modal-add-button"
          >
            Добавить расчёт
          </Button>
        }
      >
        <div className="fill-calculations-modal-content">
          <CalculationsTable
            data={modal.calculations || []}
            loading={modal.isLoading}
            variant="modal"
            onDelete={modal.handleDelete}
            onEdit={modal.handleEditCalculation}
          />
        </div>
      </Modal>
      <ConfirmationModal
        open={modal.deleteConfirmation.isOpen}
        title="Удаление расчёта"
        message="Вы действительно хотите удалить этот расчёт?"
        confirmText="Подтвердить"
        cancelText="Отмена"
        onConfirm={modal.handleDeleteConfirm}
        onCancel={modal.handleDeleteCancel}
        modalWidth="450"
      />
    </>
  );
};

export default FillCalculationsModal;
