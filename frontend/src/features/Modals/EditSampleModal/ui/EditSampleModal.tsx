import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal, Input, Select, message } from 'antd';
import { AxiosError } from 'axios';
import dayjs from 'dayjs';
import { sampleApi, type SampleUpdate } from '../../../../shared/api/sample';
import { DatePicker } from '../../../../shared/ui/FormItems';
import './EditSampleModal.css';

const { Option } = Select;

interface EditSampleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sampleId: number;
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

function EditSampleModal({ open, onClose, onSuccess, sampleId }: EditSampleModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<SampleUpdate>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const { data: sample, isLoading: isLoadingSample } = useQuery({
    queryKey: ['sample', sampleId],
    queryFn: () => sampleApi.getSample(sampleId),
    enabled: open && !!sampleId,
  });

  useEffect(() => {
    if (sample) {
      setFormData({
        registration_number: sample.registration_number,
        test_object: sample.test_object,
        sampling_date: sample.sampling_date,
        receiving_date: sample.receiving_date,
        well: sample.well,
        mode: sample.mode,
      });
    }
  }, [sample]);

  const updateMutation = useMutation({
    mutationFn: (data: SampleUpdate) => sampleApi.updateSample(sampleId, data),
    onSuccess: () => {
      message.success('Проба успешно обновлена');
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      queryClient.invalidateQueries({ queryKey: ['sample', sampleId] });
      onSuccess();
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ detail?: string }>;
      message.error(axiosError.response?.data?.detail || 'Ошибка при обновлении пробы');
    },
  });

  const handleClose = () => {
    setFormData({});
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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const data: SampleUpdate = {
        registration_number: formData.registration_number,
        test_object: formData.test_object,
        sampling_date: formData.sampling_date
          ? dayjs(formData.sampling_date).format('YYYY-MM-DD')
          : undefined,
        receiving_date: formData.receiving_date
          ? dayjs(formData.receiving_date).format('YYYY-MM-DD')
          : undefined,
        well: formData.well || undefined,
        mode: formData.mode || undefined,
      };

      await updateMutation.mutateAsync(data);
    } catch (error) {
      console.error('Ошибка при обновлении пробы:', error);
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingSample) {
    return (
      <Modal title="Редактирование пробы" open={open} onCancel={handleClose} footer={null}>
        <div>Загрузка...</div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Редактирование пробы"
      open={open}
      onCancel={handleClose}
      onOk={handleSave}
      confirmLoading={loading}
      width={600}
      okText="Сохранить"
      cancelText="Отмена"
    >
      <div className="edit-sample-modal-content">
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

export default EditSampleModal;
