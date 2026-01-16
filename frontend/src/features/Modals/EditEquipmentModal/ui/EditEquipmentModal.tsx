import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import { Checkbox, message, Spin } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { type Equipment, type EquipmentUpdate } from '../../../../shared/api/equipment';
import { researchApi } from '../../../../shared/api/research';
import { useUpdateEquipment } from '../../../../shared/model/hooks';
import { useAutoRefetchQuery } from '../../../../shared/model/lib/useQuery';
import { Input, Select, DatePicker } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import './EditEquipmentModal.css';

dayjs.locale('ru');

const { Option } = Select;

const EQUIPMENT_TYPE_OPTIONS = [
  { value: 'measuring_instrument', label: 'Средство измерения' },
  { value: 'test_equipment', label: 'Испытательное оборудование' },
];

interface EditEquipmentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  equipment: Equipment;
  laboratoryId?: number;
  departmentId?: number;
}

const EditEquipmentModal: React.FC<EditEquipmentModalProps> = ({
  open,
  onClose,
  onSuccess,
  equipment,
  laboratoryId,
  departmentId,
}) => {
  const updateEquipmentMutation = useUpdateEquipment();
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [selectedMethods, setSelectedMethods] = useState<number[]>([]);
  const spinnerIndicator = <LoadingOutlined style={{ fontSize: 24, color: '#1677ff' }} spin />;

  const { data: methodsData, isLoading: isLoadingMethods } = useAutoRefetchQuery(
    ['research-methods', 'for-equipment', laboratoryId, departmentId],
    () =>
      researchApi.getResearchMethods({
        laboratory_id: laboratoryId,
        department_id: departmentId,
      }),
    {
      enabled: open && !!laboratoryId,
    }
  );

  const { data: groupsData } = useAutoRefetchQuery(
    ['research-method-groups', 'for-equipment'],
    () => researchApi.getResearchMethodGroups({}),
    {
      enabled: open,
    }
  );

  const methodsWithDisplayNames = useMemo(() => {
    if (!methodsData?.items || !groupsData?.items) {
      return [];
    }

    const groupsMap = new Map(
      groupsData.items.map(group => [
        group.id,
        { name: group.name, sort_order: group.sort_order || 0 },
      ])
    );

    const methodsWithGroups: Array<{
      id: number;
      name: string;
      displayName: string;
      nd_code: string;
      sort_order: number;
      groupId: number;
      groupSortOrder: number;
    }> = [];
    const methodsWithoutGroups: Array<{
      id: number;
      name: string;
      displayName: string;
      nd_code: string;
      sort_order: number;
    }> = [];

    methodsData.items
      .filter(method => !method.deleted_at)
      .forEach(method => {
        const groupInfo =
          method.groups && method.groups.length > 0 ? groupsMap.get(method.groups[0].id) : null;

        let displayName = method.name;
        if (groupInfo && method.name) {
          displayName = `${groupInfo.name} ${method.name.charAt(0).toLowerCase()}${method.name.slice(1)}`;
        }

        const methodData = {
          id: method.id,
          name: method.name,
          displayName: `${displayName} (${method.nd_code})`,
          nd_code: method.nd_code,
          sort_order: method.sort_order || 0,
        };

        if (groupInfo && method.groups && method.groups.length > 0) {
          methodsWithGroups.push({
            ...methodData,
            groupId: method.groups[0].id,
            groupSortOrder: groupInfo.sort_order,
          });
        } else {
          methodsWithoutGroups.push(methodData);
        }
      });

    const groupedMethods = new Map<number, typeof methodsWithGroups>();
    methodsWithGroups.forEach(method => {
      if (!groupedMethods.has(method.groupId)) {
        groupedMethods.set(method.groupId, []);
      }
      groupedMethods.get(method.groupId)!.push(method);
    });

    const sortedGroups = Array.from(groupedMethods.entries()).sort((a, b) => {
      const groupA = groupsMap.get(a[0]);
      const groupB = groupsMap.get(b[0]);
      const sortOrderA = groupA?.sort_order || 0;
      const sortOrderB = groupB?.sort_order || 0;
      if (sortOrderA !== sortOrderB) {
        return sortOrderA - sortOrderB;
      }
      const nameA = groupA?.name || '';
      const nameB = groupB?.name || '';
      return nameA.localeCompare(nameB);
    });

    sortedGroups.forEach(([, methods]) => {
      methods.sort((a, b) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return a.displayName.localeCompare(b.displayName);
      });
    });

    methodsWithoutGroups.sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return a.displayName.localeCompare(b.displayName);
    });

    const result: Array<{
      id: number;
      name: string;
      displayName: string;
      nd_code: string;
      sort_order: number;
    }> = [];

    sortedGroups.forEach(([, methods]) => {
      methods.forEach(method => {
        result.push({
          id: method.id,
          name: method.name,
          displayName: method.displayName,
          nd_code: method.nd_code,
          sort_order: method.sort_order,
        });
      });
    });

    result.push(...methodsWithoutGroups);

    return result;
  }, [methodsData, groupsData]);

  const [formData, setFormData] = useState({
    type: undefined as string | undefined,
    name: '',
    serial_number: '',
    verification_info: '',
    verification_date: null as dayjs.Dayjs | null,
    verification_end_date: null as dayjs.Dayjs | null,
  });

  useEffect(() => {
    if (open && equipment) {
      setFormData({
        type: equipment.type || undefined,
        name: equipment.name || '',
        serial_number: equipment.serial_number || '',
        verification_info: equipment.verification_info || '',
        verification_date: equipment.verification_date ? dayjs(equipment.verification_date) : null,
        verification_end_date: equipment.verification_end_date
          ? dayjs(equipment.verification_end_date)
          : null,
      });
      setSelectedMethods(equipment.method_data_default || []);
      setErrors({});
    }
  }, [open, equipment]);

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

    const equipmentData: EquipmentUpdate = {
      type: formData.type,
      name: formData.name,
      serial_number: formData.serial_number,
      verification_info: formData.verification_info,
      verification_date: formData.verification_date!.format('YYYY-MM-DD'),
      verification_end_date: formData.verification_end_date!.format('YYYY-MM-DD'),
      laboratory_id: laboratoryId,
      department_id: departmentId,
      method_data_default: selectedMethods,
    };

    await updateEquipmentMutation.mutateAsync({ id: equipment.id, data: equipmentData });
    onSuccess();
  }, [
    formData,
    equipment.id,
    laboratoryId,
    departmentId,
    selectedMethods,
    updateEquipmentMutation,
    onSuccess,
    validateForm,
  ]);

  const handleCancel = useCallback(() => {
    if (equipment) {
      setFormData({
        type: equipment.type || undefined,
        name: equipment.name || '',
        serial_number: equipment.serial_number || '',
        verification_info: equipment.verification_info || '',
        verification_date: equipment.verification_date ? dayjs(equipment.verification_date) : null,
        verification_end_date: equipment.verification_end_date
          ? dayjs(equipment.verification_end_date)
          : null,
      });
      setSelectedMethods(equipment.method_data_default || []);
    }
    setErrors({});
    onClose();
  }, [onClose, equipment]);

  if (!open || !equipment) return null;

  return (
    <Modal
      header="Редактирование прибора"
      onClose={onClose}
      onCancel={handleCancel}
      onSave={handleSave}
      modalWidth="550"
    >
      <div className="edit-equipment-form">
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

        <div className="form-group">
          <label>Выберите методы, которым будет доступен этот прибор</label>
          {isLoadingMethods ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Spin indicator={spinnerIndicator} tip="Загрузка методов..." />
            </div>
          ) : (
            <div
              style={{
                maxHeight: '300px',
                overflowY: 'auto',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                padding: '8px',
              }}
            >
              {methodsWithDisplayNames.map(method => (
                <Checkbox
                  key={method.id}
                  checked={selectedMethods.includes(method.id)}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedMethods(prev => [...prev, method.id]);
                    } else {
                      setSelectedMethods(prev => prev.filter(id => id !== method.id));
                    }
                  }}
                  className="method-checkbox"
                >
                  {method.displayName}
                </Checkbox>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default EditEquipmentModal;
