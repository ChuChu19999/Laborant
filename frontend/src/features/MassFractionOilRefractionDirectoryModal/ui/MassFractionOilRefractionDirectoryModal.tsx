import { MassFractionOilRefractionDirectoryTable } from '@/entities/MassFractionOilRefraction';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/FormItems';
import { PlusOutlined } from '@/shared/ui/icons';
import { Modal } from '@/shared/ui/Modal';
import { useMassFractionOilRefractionDirectoryModal } from '../model/useMassFractionOilRefractionDirectoryModal';
import './MassFractionOilRefractionDirectoryModal.css';

export interface MassFractionOilRefractionDirectoryModalProps {
  open: boolean;
  onClose: () => void;
  researchMethodId?: number;
  methodName?: string;
  canUpdate?: boolean;
}

const MassFractionOilRefractionDirectoryModal = ({
  open,
  onClose,
  researchMethodId,
  canUpdate = true,
}: MassFractionOilRefractionDirectoryModalProps) => {
  const modal = useMassFractionOilRefractionDirectoryModal({
    open,
    onClose,
    researchMethodId,
    canUpdate,
  });

  if (!open) return null;

  return (
    <Modal
      header={`Рефрактометрическая таблица`}
      onClose={onClose}
      onCancel={modal.handleCancel}
      showEditButton={false}
      editable={false}
      modalWidth="1000"
      onSave={modal.canUpdate ? modal.handleSave : undefined}
    >
      <div className="mass-fraction-oil-refraction-directory-modal-content">
        {modal.canUpdate && (
          <div className="mass-fraction-oil-refraction-directory-modal-form">
            <div className="mass-fraction-oil-refraction-form-row">
              <Input
                placeholder="Массовая доля масла (C), %"
                value={modal.newEntry.c_value}
                onChange={e => modal.handleCValueChange(e.target.value)}
                className="mass-fraction-oil-refraction-directory-modal-input"
              />
              <Input
                placeholder="Показатель преломления (n)"
                value={modal.newEntry.n_value}
                onChange={e => modal.handleNValueChange(e.target.value)}
                className="mass-fraction-oil-refraction-directory-modal-input"
              />
              {modal.editingIndex === null ? (
                <Button type="primary" icon={<PlusOutlined />} onClick={modal.handleAdd}>
                  Добавить
                </Button>
              ) : (
                <div className="mass-fraction-oil-refraction-directory-modal-actions">
                  <Button
                    type="primary"
                    onClick={modal.handleUpdate}
                    className="mass-fraction-oil-refraction-directory-modal-save-button"
                  >
                    Сохранить
                  </Button>
                  <Button
                    onClick={modal.handleEditCancel}
                    className="mass-fraction-oil-refraction-directory-modal-cancel-button"
                  >
                    Отмена
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mass-fraction-oil-refraction-directory-modal-table-container">
          <MassFractionOilRefractionDirectoryTable
            data={modal.entries}
            loading={modal.isLoading}
            onEdit={modal.canUpdate ? modal.handleEdit : undefined}
            onDelete={modal.canUpdate ? modal.handleDelete : undefined}
          />
        </div>
      </div>
    </Modal>
  );
};

export default MassFractionOilRefractionDirectoryModal;
