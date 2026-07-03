import React, { useEffect, useState } from 'react';
import { Radio } from 'antd';
import Button from '../../../../shared/ui/Button/Button';
import { Modal } from '../../../../shared/ui/Modal';
import type { MethodologyChoice } from '../../../../shared/api/calculation';
import './MethodologyVersionChoiceModal.css';

interface MethodologyVersionChoiceModalProps {
  open: boolean;
  choice: MethodologyChoice | null;
  onChooseStored: () => void;
  onChooseCurrent: (methodId: number) => void;
  onCancel: () => void;
}

const MethodologyVersionChoiceModal: React.FC<MethodologyVersionChoiceModalProps> = ({
  open,
  choice,
  onChooseStored,
  onChooseCurrent,
  onCancel,
}) => {
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !choice) {
      setSelectedCandidateId(null);
      return;
    }

    if (choice.methodology_ambiguous) {
      setSelectedCandidateId(choice.candidate_methods?.[0]?.id ?? null);
      return;
    }

    setSelectedCandidateId(choice.current_method_id);
  }, [open, choice]);

  if (!open || !choice) {
    return null;
  }

  const isAmbiguous = Boolean(choice.methodology_ambiguous);
  const canChooseCurrent = isAmbiguous
    ? selectedCandidateId != null
    : choice.current_method_id != null;

  const handleChooseCurrent = () => {
    const methodId = isAmbiguous ? selectedCandidateId : choice.current_method_id;
    if (methodId == null) {
      return;
    }
    onChooseCurrent(methodId);
  };

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
          <Button
            title={isAmbiguous ? 'По выбранной методике' : 'По новой методике'}
            type="primary"
            onClick={handleChooseCurrent}
            disabled={!canChooseCurrent}
          >
            {isAmbiguous ? 'По выбранной методике' : 'По новой методике'}
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
          {isAmbiguous ? (
            <div className="methodology-version-choice-modal-candidates">
              <p>
                <span className="methodology-version-choice-modal-marker">б)</span>
                <strong>По актуальной методике</strong> — выберите подходящую версию:
              </p>
              <Radio.Group
                className="methodology-version-choice-modal-radio-group"
                value={selectedCandidateId}
                onChange={event => setSelectedCandidateId(event.target.value)}
              >
                {choice.candidate_methods?.map(candidate => (
                  <Radio key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </Radio>
                ))}
              </Radio.Group>
            </div>
          ) : (
            <p>
              <span className="methodology-version-choice-modal-marker">б)</span>
              <strong>По новой методике</strong> — актуальные правила на сегодняшний день
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default MethodologyVersionChoiceModal;
