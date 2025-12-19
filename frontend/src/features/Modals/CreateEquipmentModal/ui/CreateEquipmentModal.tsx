import React, { useCallback, useState, useEffect } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { type EquipmentCreate } from '../../../../shared/api/equipment';
import { useCreateEquipment } from '../../../../shared/model/hooks';
import { Input, Select, DatePicker } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import './CreateEquipmentModal.css';

dayjs.locale('ru');

const { Option } = Select;

const EQUIPMENT_TYPE_OPTIONS = [
  { value: 'measuring_instrument', label: 'Средство измерения' },
  { value: 'test_equipment', label: 'Испытательное оборудование' },
];

interface CreateEquipmentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  laboratoryId?: number;
  departmentId?: number;
}

const CreateEquipmentModal: React.FC<CreateEquipmentModalProps> = ({
  open,
  onClose,
  onSuccess,
  laboratoryId,
  departmentId,
}) => {
  const createEquipmentMutation = useCreateEquipment();
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    type: undefined as string | undefined,
    name: '',
    serial_number: '',
    verification_info: '',
    verification_date: null as dayjs.Dayjs | null,
    verification_end_date: null as dayjs.Dayjs | null,
  });

  useEffect(() => {
    if (!open) {
      setFormData({
        type: undefined,
        name: '',
        serial_number: '',
        verification_info: '',
        verification_date: null,
        verification_end_date: null,
      });
      setErrors({});
    }
  }, [open]);

  const handleInputChange = useCallback(
    (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData(prev => ({
        ...prev,
        [field]: e.target.value,
      }));
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: false }));
      }
    },
    [errors]
  );

  const handleSelectChange = useCallback(
    (field: 'type') => (value: unknown) => {
      setFormData(prev => ({
        ...prev,
        [field]: (value as string | undefined) || undefined,
      }));
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: false }));
      }
    },
    [errors]
  );

  const handleDateChange = useCallback(
    (field: 'verification_date' | 'verification_end_date') => (date: unknown) => {
      setFormData(prev => ({
        ...prev,
        [field]: (date as dayjs.Dayjs | null) || null,
      }));
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: false }));
      }
    },
    [errors]
  );

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, boolean> = {};

    if (!formData.type) {
      newErrors.type = true;
    }
    if (!formData.name.trim()) {
      newErrors.name = true;
    }
    if (!formData.serial_number.trim()) {
      newErrors.serial_number = true;
    }
    if (!formData.verification_info.trim()) {
      newErrors.verification_info = true;
    }
    if (!formData.verification_date) {
      newErrors.verification_date = true;
    }
    if (!formData.verification_end_date) {
      newErrors.verification_end_date = true;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      message.error('Пожалуйста, заполните все обязательные поля');
      return false;
    }

    setErrors({});
    return true;
  }, [formData]);

  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    if (!laboratoryId) {
      message.error('Лаборатория не выбрана');
      return;
    }

    const equipmentData: EquipmentCreate = {
      type: formData.type!,
      name: formData.name,
      serial_number: formData.serial_number,
      verification_info: formData.verification_info,
      verification_date: formData.verification_date!.format('YYYY-MM-DD'),
      verification_end_date: formData.verification_end_date!.format('YYYY-MM-DD'),
      laboratory_id: laboratoryId,
      department_id: departmentId,
    };

    await createEquipmentMutation.mutateAsync(equipmentData);
    onSuccess();
  }, [formData, laboratoryId, departmentId, createEquipmentMutation, onSuccess, validateForm]);

  const handleCancel = useCallback(() => {
    setFormData({
      type: undefined,
      name: '',
      serial_number: '',
      verification_info: '',
      verification_date: null,
      verification_end_date: null,
    });
    setErrors({});
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <Modal
      header="Создание прибора"
      onClose={onClose}
      onCancel={handleCancel}
      onSave={handleSave}
      modalWidth="550"
    >
      <div className="create-equipment-form">
        <div className="form-group">
          <label>
            Тип <span className="required">*</span>
          </label>
          <Select
            value={formData.type}
            onChange={handleSelectChange('type')}
            placeholder="Выберите тип прибора"
            status={errors.type ? 'error' : ''}
            allowClear
          >
            {EQUIPMENT_TYPE_OPTIONS.map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        </div>

        <div className="form-group">
          <label>
            Наименование <span className="required">*</span>
          </label>
          <Input
            value={formData.name}
            onChange={handleInputChange('name')}
            placeholder="Введите наименование прибора"
            status={errors.name ? 'error' : ''}
          />
        </div>

        <div className="form-group">
          <label>
            Заводской номер <span className="required">*</span>
          </label>
          <Input
            value={formData.serial_number}
            onChange={handleInputChange('serial_number')}
            placeholder="Введите заводской номер"
            status={errors.serial_number ? 'error' : ''}
          />
        </div>

        <div className="form-group">
          <label>
            Сведения о результатах поверки <span className="required">*</span>
          </label>
          <Input
            value={formData.verification_info}
            onChange={handleInputChange('verification_info')}
            placeholder="Введите сведения о результатах поверки"
            status={errors.verification_info ? 'error' : ''}
          />
        </div>

        <div className="form-group">
          <label>
            Дата поверки <span className="required">*</span>
          </label>
          <DatePicker
            value={formData.verification_date}
            onChange={handleDateChange('verification_date')}
            placeholder="ДД.ММ.ГГГГ"
            format="DD.MM.YYYY"
            status={errors.verification_date ? 'error' : ''}
          />
        </div>

        <div className="form-group">
          <label>
            Дата окончания поверки <span className="required">*</span>
          </label>
          <DatePicker
            value={formData.verification_end_date}
            onChange={handleDateChange('verification_end_date')}
            placeholder="ДД.ММ.ГГГГ"
            format="DD.MM.YYYY"
            status={errors.verification_end_date ? 'error' : ''}
          />
        </div>
      </div>
    </Modal>
  );
};

export default CreateEquipmentModal;
