import { SelectionConditionsTable } from '@/entities/SelectionCondition';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/FormItems';
import { PlusOutlined } from '@/shared/ui/icons';
import { Modal } from '@/shared/ui/Modal';
import { useSelectionConditionsModal } from '../model/useSelectionConditionsModal';
import './SelectionConditionsModal.css';

export interface SelectionConditionsModalProps {
  open: boolean;
  onClose: () => void;
  laboratoryId?: number;
  departmentId?: number;
  entityName?: string;
}

const SelectionConditionsModal = ({
  open,
  onClose,
  laboratoryId,
  departmentId,
  entityName,
}: SelectionConditionsModalProps) => {
  const modal = useSelectionConditionsModal({
    open,
    onClose,
    laboratoryId,
    departmentId,
  });

  if (!open) return null;

  return (
    <Modal
      header={`Условия отбора - ${entityName || ''}${modal.hasChanges ? ' (изменено)' : ''}`}
      onClose={onClose}
      onCancel={modal.handleCancel}
      showEditButton={false}
      editable={false}
      modalWidth="1000"
      onSave={modal.handleSave}
    >
      <div className="selection-conditions-modal-content">
        <div className="selection-conditions-modal-form">
          <div className="selection-conditions-form-row">
            <Input
              placeholder="Переменная"
              value={modal.newCondition.variable}
              onChange={e =>
                modal.setNewCondition({ ...modal.newCondition, variable: e.target.value })
              }
              className="selection-conditions-modal-input"
            />
            <Input
              placeholder="Единица измерения"
              value={modal.newCondition.unit}
              onChange={e => modal.setNewCondition({ ...modal.newCondition, unit: e.target.value })}
              className="selection-conditions-modal-input"
            />
            {modal.editingIndex === null ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={modal.handleAdd}>
                Добавить
              </Button>
            ) : (
              <div className="selection-conditions-modal-actions">
                <Button
                  type="primary"
                  onClick={modal.handleUpdate}
                  className="selection-conditions-modal-save-button"
                >
                  Сохранить
                </Button>
                <Button
                  onClick={modal.handleEditCancel}
                  className="selection-conditions-modal-cancel-button"
                >
                  Отмена
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="selection-conditions-modal-table-container">
          <SelectionConditionsTable
            data={modal.conditions}
            loading={modal.isLoading}
            onEdit={modal.handleEdit}
            onDelete={modal.handleDelete}
          />
        </div>
      </div>
    </Modal>
  );
};

export default SelectionConditionsModal;
