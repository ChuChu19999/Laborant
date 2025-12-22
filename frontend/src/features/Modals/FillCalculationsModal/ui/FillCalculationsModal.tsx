import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined } from '@ant-design/icons';
import { CalculationsTable } from '../../../../entities/CalculationsTable';
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
  const { data: calculations, isLoading } = useAutoRefetchQuery<Calculation[]>(
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

  if (!open) return null;

  return (
    <Modal
      header={`Расчеты для пробы №${sample.registration_number}`}
      onClose={handleCancel}
      onCancel={handleCancel}
      showEditButton={false}
      editable={false}
      modalWidth="1000"
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
          <CalculationsTable data={calculations || []} loading={isLoading} />
        )}
      </div>
    </Modal>
  );
};

export default FillCalculationsModal;
