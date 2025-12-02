import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, Input, Select, message } from 'antd';
import { AxiosError } from 'axios';
import dayjs from 'dayjs';
import { sampleApi, type SampleCreate } from '../../../../shared/api/sample';
import { DatePicker } from '../../../../shared/ui/FormItems';
import './CreateSampleModal.css';

const { Option } = Select;

interface CreateSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  laboratoryId?: number;
  departmentId?: number;
}

const testObjects = [
  'дегазированный конденсат',
  'нефть',
  'нефть калибровочная',
  'нефтеконденсатная смесь',
  'дизельное топливо',
  'отработанные нефтепродукты',
  'масло турбинное',
  'масло авиационное',
  'смесь жидких углеводородов',
  'ингибитор коррозии',
];

function CreateSampleModal({
  isOpen,
  onClose,
  onSuccess,
  laboratoryId,
  departmentId,
}: CreateSampleModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<SampleCreate>>({
    registration_number: '',
    test_object: undefined,
    sampling_date: undefined,
    receiving_date: undefined,
    well: '',
    mode: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: SampleCreate) => sampleApi.createSample(data),
    onSuccess: () => {
      message.success('Проба успешно создана');
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      onSuccess();
      handleClose();
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ detail?: string }>;
      message.error(axiosError.response?.data?.detail || 'Ошибка при создании пробы');
    },
  });

  const handleClose = () => {
    setFormData({
      registration_number: '',
      test_object: undefined,
      sampling_date: undefined,
      receiving_date: undefined,
      well: '',
      mode: '',
    });
    setErrors({});
    onClose();
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.registration_number) {
      newErrors.registration_number = 'Обязательное поле';
    }
    if (!formData.test_object) {
      newErrors.test_object = 'Обязательное поле';
    }
    if (!laboratoryId) {
      newErrors.laboratory = 'Необходимо выбрать лабораторию';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const data: SampleCreate = {
        registration_number: formData.registration_number!,
        test_object: formData.test_object!,
        sampling_date: formData.sampling_date
          ? dayjs(formData.sampling_date).format('YYYY-MM-DD')
          : undefined,
        receiving_date: formData.receiving_date
          ? dayjs(formData.receiving_date).format('YYYY-MM-DD')
          : undefined,
        well: formData.well || undefined,
        mode: formData.mode || undefined,
        laboratory_id: laboratoryId!,
        department_id: departmentId,
      };

      await createMutation.mutateAsync(data);
    } catch (error) {
      console.error('Ошибка при создании пробы:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Создание пробы"
      open={isOpen}
      onCancel={handleClose}
      onOk={handleSave}
      confirmLoading={loading}
      width={600}
      okText="Создать"
      cancelText="Отмена"
    >
      <div className="create-sample-modal-content">
        <div className="form-field">
          <label>
            Регистрационный номер <span className="required">*</span>
          </label>
          <Input
            value={formData.registration_number}
            onChange={e => {
              setFormData({ ...formData, registration_number: e.target.value });
              if (errors.registration_number) {
                setErrors({ ...errors, registration_number: '' });
              }
            }}
            placeholder="Введите регистрационный номер"
            status={errors.registration_number ? 'error' : ''}
          />
          {errors.registration_number && (
            <div className="error-text">{errors.registration_number}</div>
          )}
        </div>

        <div className="form-field">
          <label>
            Объект испытаний <span className="required">*</span>
          </label>
          <Select
            value={formData.test_object}
            onChange={value => {
              setFormData({ ...formData, test_object: value });
              if (errors.test_object) {
                setErrors({ ...errors, test_object: '' });
              }
            }}
            placeholder="Выберите объект испытаний"
            status={errors.test_object ? 'error' : ''}
          >
            {testObjects.map(obj => (
              <Option key={obj} value={obj}>
                {obj}
              </Option>
            ))}
          </Select>
          {errors.test_object && <div className="error-text">{errors.test_object}</div>}
        </div>

        <div className="form-field">
          <label>Скважина</label>
          <Input
            value={formData.well}
            onChange={e => setFormData({ ...formData, well: e.target.value })}
            placeholder="Введите скважину"
          />
        </div>

        <div className="form-field">
          <label>Режим</label>
          <Input
            value={formData.mode}
            onChange={e => setFormData({ ...formData, mode: e.target.value })}
            placeholder="Введите режим"
          />
        </div>

        <div className="form-field">
          <label>Дата отбора пробы</label>
          <DatePicker
            value={formData.sampling_date ? dayjs(formData.sampling_date) : null}
            onChange={date =>
              setFormData({ ...formData, sampling_date: date ? date.toISOString() : undefined })
            }
            format="DD.MM.YYYY"
            placeholder="ДД.ММ.ГГГГ"
            style={{ width: '100%' }}
          />
        </div>

        <div className="form-field">
          <label>Дата получения пробы</label>
          <DatePicker
            value={formData.receiving_date ? dayjs(formData.receiving_date) : null}
            onChange={date =>
              setFormData({ ...formData, receiving_date: date ? date.toISOString() : undefined })
            }
            format="DD.MM.YYYY"
            placeholder="ДД.ММ.ГГГГ"
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </Modal>
  );
}

export default CreateSampleModal;
