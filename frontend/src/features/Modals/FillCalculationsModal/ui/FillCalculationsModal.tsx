import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { ConfirmationModal } from '../../../../entities/ConfirmationModal';
import { CalculationsTable } from '../../../../entities/Tables/CalculationsTable';
import { calculationApi } from '../../../../shared/api/calculation';
import { useAutoRefetchQuery } from '../../../../shared/model/lib/useQuery';
import Button from '../../../../shared/ui/Button/Button';
import { Modal } from '../../../../shared/ui/Modal';
import { LoadingCard } from '../../../Cards';
import type { Calculation } from '../../../../shared/api/calculation';
import type { Sample } from '../../../../shared/api/samples';
import './FillCalculationsModal.css';

interface FillCalculationsModalProps {
  open: boolean;
  onClose: () => void;
  sample: Sample;
}

const FillCalculationsModal: React.FC<FillCalculationsModalProps> = ({ open, onClose, sample }) => {
  const navigate = useNavigate();
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    calculationId: number | null;
  }>({
    isOpen: false,
    calculationId: null,
  });

  const {
    data: calculations,
    isLoading,
    refetch,
  } = useAutoRefetchQuery<Calculation[]>(
    ['calculations', 'sample', sample.id],
    () => calculationApi.getCalculationsBySample(sample.id),
    {
      enabled: open && !!sample.id,
    }
  );

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleAddCalculation = useCallback(() => {
    if (sample.laboratory_id && sample.department_id) {
      const path = `/samples/laboratory/${sample.laboratory_id}/department/${sample.department_id}/calculations?sampleId=${sample.id}`;
      navigate(path);
    }
    onClose();
  }, [navigate, sample, onClose]);

  const handleDelete = useCallback((calculationId: number) => {
    setDeleteConfirmation({
      isOpen: true,
      calculationId,
    });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirmation.calculationId) return;

    try {
      await calculationApi.deleteCalculation(deleteConfirmation.calculationId);
      message.success('Расчет успешно удален');
      setDeleteConfirmation({
        isOpen: false,
        calculationId: null,
      });
      await refetch();
    } catch (error) {
      console.error('Ошибка при удалении расчета:', error);
      message.error('Не удалось удалить расчет');
    }
  }, [deleteConfirmation.calculationId, refetch]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmation({
      isOpen: false,
      calculationId: null,
    });
  }, []);

  if (!open) return null;

  return (
    <>
      <Modal
        header={`Расчеты для пробы №${sample.registration_number}`}
        onClose={handleCancel}
        onCancel={handleCancel}
        showEditButton={false}
        editable={false}
        modalWidth="1800"
        extraButtons={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddCalculation}
            className="fill-calculations-modal-add-button"
          >
            Добавить расчет
          </Button>
        }
      >
        <div className="fill-calculations-modal-content">
          {isLoading ? (
            <LoadingCard loading={isLoading} />
          ) : (
            <CalculationsTable
              data={calculations || []}
              loading={isLoading}
              onDelete={handleDelete}
            />
          )}
        </div>
      </Modal>
      <ConfirmationModal
        open={deleteConfirmation.isOpen}
        title="Удаление расчета"
        message="Вы действительно хотите удалить этот расчет?"
        confirmText="Подтвердить"
        cancelText="Отмена"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        modalWidth="450"
      />
    </>
  );
};

export default FillCalculationsModal;
