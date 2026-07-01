import React from 'react';
import Button from '../../../../shared/ui/Button/Button';
import { Modal } from '../../../../shared/ui/Modal';
import type { MethodologyChoice } from '../../../../shared/api/calculation';
import './MethodologyVersionChoiceModal.css';

interface MethodologyVersionChoiceModalProps {
  open: boolean;
  choice: MethodologyChoice | null;
  onChooseStored: () => void;
  onChooseCurrent: () => void;
  onCancel: () => void;
}

const MethodologyVersionChoiceModal: React.FC<MethodologyVersionChoiceModalProps> = ({
  open,
  choice,
  onChooseStored,
  onChooseCurrent,
  onCancel,
}) => {
  if (!open || !choice) {
    return null;
  }

  return (
    <Modal
      header="Изменение методики расчёта"
      onClose={onCancel}
      onCancel={onCancel}
      cancelText="Отмена"
      modalWidth="550"
      extraButtons={
        <div className="methodology-version-choice-modal-actions">
          <Button title="По старой методике" type="primary" onClick={onChooseStored}>
            По старой методике
          </Button>
          <Button title="По новой методике" type="primary" onClick={onChooseCurrent}>
            По новой методике
          </Button>
        </div>
      }
    >
      <div className="methodology-version-choice-modal-content">
        <p>
          Для метода «{choice.method_name}» с момента сохранения расчёта изменилась методика
          расчёта.
        </p>
        <p>Выберите, по какой версии редактировать расчёт:</p>
        <div className="methodology-version-choice-modal-list">
          <p>
            <span className="methodology-version-choice-modal-marker">а)</span>
            <strong>По старой методике</strong> — правила и формулы на момент сохранения расчёта
          </p>
          <p>
            <span className="methodology-version-choice-modal-marker">б)</span>
            <strong>По новой методике</strong> — актуальные правила на сегодняшний день
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default MethodologyVersionChoiceModal;
