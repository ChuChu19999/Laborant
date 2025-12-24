import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Checkbox, message } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { UserPicker, type Employee } from '../../../../entities/UserPicker';
import { employeesApi } from '../../../../shared/api/employees';
import { laboratoriesApi } from '../../../../shared/api/laboratories';
import {
  protocolsApi,
  type Protocol,
  type ProtocolUpdate,
  type ProtocolTemplate,
} from '../../../../shared/api/protocols';
import { samplesApi, type Sample } from '../../../../shared/api/samples';
import { useUpdateProtocol } from '../../../../shared/model/hooks';
import { useAutoRefetchQuery } from '../../../../shared/model/lib/useQuery';
import { Input, Select, DatePicker } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import './EditProtocolModal.css';

dayjs.locale('ru');

const { Option } = Select;

const ISSUED_POSITION_OPTIONS = [
  { value: 'Ведущий инженер-химик', label: 'Ведущий инженер-химик' },
  { value: 'Инженер-химик 1 категории', label: 'Инженер-химик 1 категории' },
  { value: 'Инженер-химик 2 категории', label: 'Инженер-химик 2 категории' },
];

const APPROVED_POSITION_OPTIONS = [
  { value: 'Начальник лаборатории', label: 'Начальник лаборатории' },
  { value: 'И.о. начальника лаборатории', label: 'И.о. начальника лаборатории' },
  { value: 'Начальник отдела', label: 'Начальник отдела' },
  { value: 'Зам. начальника отдела', label: 'Зам. начальника отдела' },
];

interface EditProtocolModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  protocol: Protocol;
  laboratoryId?: number;
  departmentId?: number;
}

const EditProtocolModal: React.FC<EditProtocolModalProps> = ({
  open,
  onClose,
  onSuccess,
  protocol,
  laboratoryId,
  departmentId,
}) => {
  const updateProtocolMutation = useUpdateProtocol();
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    test_protocol_number: '',
    test_protocol_date: null as dayjs.Dayjs | null,
    is_accredited: false,
    sampling_act_number: '',
    issued: null as Employee | null,
    approved: null as Employee | null,
    issued_position: undefined as string | undefined,
    approved_position: undefined as string | undefined,
    protocol_template_id: undefined as number | undefined,
    samples: [] as number[],
  });

  // Загрузка данных сотрудников для issued и approved
  const loadEmployee = useCallback(
    async (hash: string | undefined, setEmployee: (emp: Employee | null) => void) => {
      if (!hash) {
        setEmployee(null);
        return;
      }
      try {
        const employee = await employeesApi.getByHash(hash, true);
        if (employee) {
          setEmployee({
            hashMd5: employee.hashMd5,
            fullName: employee.fullName,
            employeePhoto: employee.employeePhoto,
            jobTitle: employee.jobTitle,
          });
        }
      } catch (error) {
        console.error('Ошибка при загрузке сотрудника:', error);
      }
    },
    []
  );

  // Запрос на получение шаблонов протоколов
  const { data: templates = [], isLoading: templatesLoading } = useAutoRefetchQuery<
    ProtocolTemplate[]
  >(
    ['protocol-templates', 'available', laboratoryId, departmentId],
    () => protocolsApi.getAvailableProtocolTemplates(laboratoryId!, departmentId),
    {
      enabled: !!laboratoryId,
    }
  );

  // Запрос на получение проб для выбора
  const { data: samplesData, isLoading: samplesLoading } = useAutoRefetchQuery<{
    items: Sample[];
    total: number;
  }>(
    ['samples', 'for-protocol', laboratoryId, departmentId],
    () =>
      samplesApi
        .getSamples(undefined, undefined, undefined, undefined, laboratoryId, departmentId)
        .then(data => ({
          items: data.items,
          total: data.total,
        })),
    {
      enabled: !!laboratoryId,
    }
  );

  // Запрос на получение названия лаборатории
  const { data: laboratory } = useAutoRefetchQuery(
    ['laboratory', laboratoryId],
    () => laboratoriesApi.getLaboratory(laboratoryId!),
    {
      enabled: !!laboratoryId,
    }
  );

  const samples = useMemo(() => samplesData?.items || [], [samplesData?.items]);
  const laboratoryName = useMemo(() => laboratory?.full_name || '', [laboratory]);

  // Группируем шаблоны по имени и определяем актуальные
  const { templatesGrouped, currentTemplateIds } = useMemo(() => {
    const grouped: Record<string, ProtocolTemplate[]> = {};
    const currentIds = new Set<number>();

    templates.forEach(template => {
      if (!grouped[template.name]) {
        grouped[template.name] = [];
      }
      grouped[template.name].push(template);
    });

    // Для каждой группы находим актуальный шаблон (самая последняя версия без deleted_at)
    Object.keys(grouped).forEach(name => {
      const groupTemplates = grouped[name];
      const activeTemplates = groupTemplates.filter(t => !t.deleted_at);

      if (activeTemplates.length > 0) {
        if (activeTemplates[0]) {
          currentIds.add(activeTemplates[0].id);
        }
      }
    });

    return { templatesGrouped: grouped, currentTemplateIds: currentIds };
  }, [templates]);

  useEffect(() => {
    if (open && protocol) {
      setFormData({
        test_protocol_number: protocol.test_protocol_number || '',
        test_protocol_date: protocol.test_protocol_date ? dayjs(protocol.test_protocol_date) : null,
        is_accredited: protocol.is_accredited || false,
        sampling_act_number: protocol.sampling_act_number || '',
        issued: null,
        approved: null,
        issued_position: protocol.issued_position || undefined,
        approved_position: protocol.approved_position || undefined,
        protocol_template_id: protocol.protocol_template_id || undefined,
        samples: protocol.samples || [],
      });
      setErrors({});

      // Загружаем данные сотрудников
      loadEmployee(protocol.issued, emp => setFormData(prev => ({ ...prev, issued: emp })));
      loadEmployee(protocol.approved, emp => setFormData(prev => ({ ...prev, approved: emp })));
    }
  }, [open, protocol, loadEmployee]);

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

  const handleDateChange = useCallback((date: unknown) => {
    setFormData(prev => ({
      ...prev,
      test_protocol_date: (date as dayjs.Dayjs | null) || null,
    }));
  }, []);

  const handleCheckboxChange = useCallback((checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      is_accredited: checked,
    }));
  }, []);

  const handleSelectChange = useCallback(
    (field: 'issued_position' | 'approved_position' | 'protocol_template_id') =>
      (value: unknown) => {
        setFormData(prev => ({
          ...prev,
          [field]: value as (typeof formData)[typeof field],
        }));
      },
    []
  );

  const handleSamplesChange = useCallback((value: unknown) => {
    const sampleIds = (value as number[]) || [];
    setFormData(prev => ({
      ...prev,
      samples: sampleIds,
    }));
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, boolean> = {};

    if (!formData.sampling_act_number.trim()) {
      newErrors.sampling_act_number = true;
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

    const protocolData: ProtocolUpdate = {
      test_protocol_number: formData.test_protocol_number || undefined,
      test_protocol_date: formData.test_protocol_date
        ? formData.test_protocol_date.format('YYYY-MM-DD')
        : undefined,
      is_accredited: formData.is_accredited,
      sampling_act_number: formData.sampling_act_number,
      issued: formData.issued?.hashMd5 || undefined,
      approved: formData.approved?.hashMd5 || undefined,
      issued_position: formData.issued_position || undefined,
      approved_position: formData.approved_position || undefined,
      protocol_template_id: formData.protocol_template_id || undefined,
      samples: formData.samples.length > 0 ? formData.samples : undefined,
    };

    await updateProtocolMutation.mutateAsync({ id: protocol.id, data: protocolData });
    onSuccess();
  }, [formData, protocol.id, updateProtocolMutation, onSuccess, validateForm]);

  const handleCancel = useCallback(() => {
    setFormData({
      test_protocol_number: protocol.test_protocol_number || '',
      test_protocol_date: protocol.test_protocol_date ? dayjs(protocol.test_protocol_date) : null,
      is_accredited: protocol.is_accredited || false,
      sampling_act_number: protocol.sampling_act_number || '',
      issued: null,
      approved: null,
      issued_position: protocol.issued_position || undefined,
      approved_position: protocol.approved_position || undefined,
      protocol_template_id: protocol.protocol_template_id || undefined,
      samples: protocol.samples || [],
    });
    setErrors({});
    onClose();
  }, [onClose, protocol]);

  if (!open) return null;

  return (
    <Modal
      header="Рдактирование протокола"
      onClose={handleCancel}
      onCancel={handleCancel}
      onSave={handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="550"
    >
      <div className="create-protocol-form">
        <div className="form-group">
          <label>Номер протокола испытаний</label>
          <Input
            value={formData.test_protocol_number}
            onChange={handleInputChange('test_protocol_number')}
            placeholder="Введите номер протокола испытаний"
          />
        </div>

        <div className="form-group">
          <label>Дата протокола испытаний</label>
          <DatePicker
            value={formData.test_protocol_date}
            onChange={handleDateChange}
            placeholder="ДД.ММ.ГГГГ"
            format="DD.MM.YYYY"
          />
        </div>

        <div className="form-group">
          <Checkbox
            checked={formData.is_accredited}
            onChange={e => handleCheckboxChange(e.target.checked)}
          >
            Аккредитован
          </Checkbox>
        </div>

        <div className="form-group">
          <label>
            Номер акта отбора <span className="required">*</span>
          </label>
          <Input
            value={formData.sampling_act_number}
            onChange={handleInputChange('sampling_act_number')}
            placeholder="Введите номер акта отбора"
            status={errors.sampling_act_number ? 'error' : ''}
          />
        </div>

        <div className="form-group">
          <label>Протокол оформил</label>
          <UserPicker
            value={formData.issued}
            onChange={employee => setFormData(prev => ({ ...prev, issued: employee }))}
            placeholder="Введите ФИО лица, оформившего протокол"
            laboratoryName={laboratoryName}
          />
        </div>

        <div className="form-group">
          <label>Должность оформившего</label>
          <Select
            value={formData.issued_position}
            onChange={handleSelectChange('issued_position')}
            placeholder="Выберите должность оформившего"
            allowClear
          >
            {ISSUED_POSITION_OPTIONS.map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        </div>

        <div className="form-group">
          <label>Протокол утвердил</label>
          <UserPicker
            value={formData.approved}
            onChange={employee => setFormData(prev => ({ ...prev, approved: employee }))}
            placeholder="Введите ФИО лица, утвердившего протокол"
            laboratoryName={laboratoryName}
          />
        </div>

        <div className="form-group">
          <label>Должность утвердившего</label>
          <Select
            value={formData.approved_position}
            onChange={handleSelectChange('approved_position')}
            placeholder="Выберите должность утвердившего"
            allowClear
          >
            {APPROVED_POSITION_OPTIONS.map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        </div>

        <div className="form-group">
          <label>Шаблон протокола</label>
          <Select
            value={formData.protocol_template_id}
            onChange={handleSelectChange('protocol_template_id')}
            placeholder="Выберите шаблон протокола"
            loading={templatesLoading}
            allowClear
          >
            {Object.entries(templatesGrouped).map(([name, groupTemplates]) => {
              return groupTemplates.map(template => {
                const isDeleted = !!template.deleted_at;
                const isCurrent = currentTemplateIds.has(template.id);

                return (
                  <Option
                    key={template.id}
                    value={template.id}
                    disabled={isDeleted}
                    className={isDeleted ? 'template-option-deleted' : ''}
                  >
                    <span className={isDeleted ? 'template-name-deleted' : ''}>
                      {name} - {template.version}
                    </span>
                    {isCurrent && !isDeleted && (
                      <span className="template-current-badge"> (Актуальный)</span>
                    )}
                    {isDeleted && <span className="template-deleted-badge"> (Устаревший)</span>}
                  </Option>
                );
              });
            })}
          </Select>
        </div>

        <div className="form-group">
          <label>Пробы</label>
          <Select
            mode="multiple"
            value={formData.samples}
            onChange={handleSamplesChange}
            placeholder="Выберите пробы"
            loading={samplesLoading}
            allowClear
            showSearch
            filterOption={(input, option) => {
              const sample = samples.find((s: Sample) => s.id === option?.value);
              return sample
                ? sample.registration_number.toLowerCase().includes(input.toLowerCase())
                : false;
            }}
            listHeight={200}
          >
            {samples.map((sample: Sample) => (
              <Option key={sample.id} value={sample.id}>
                {sample.registration_number} - {sample.test_object}
              </Option>
            ))}
          </Select>
        </div>
      </div>
    </Modal>
  );
};

export default EditProtocolModal;
