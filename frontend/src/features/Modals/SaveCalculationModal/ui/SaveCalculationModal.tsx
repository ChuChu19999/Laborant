import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CloseCircleFilled } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Input, Spin, message } from 'antd';
import { type Dayjs } from 'dayjs';
import { calculationApi } from '../../../../shared/api/calculation';
import { employeesApi } from '../../../../shared/api/employees';
import { sampleApi } from '../../../../shared/api/sample';
import Modal from '../../../../shared/ui/Modal/ui/Modal';
import type { ResearchMethodResponse } from '../../../../shared/api/research';
import './SaveCalculationModal.css';

interface SaveCalculationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  calculationResult: {
    result: string;
    measurement_error?: string;
    input_data: Record<string, unknown>;
    laboratory_activity_date: Dayjs | null;
  };
  currentMethod: ResearchMethodResponse | null;
  laboratoryId: number;
  departmentId?: number;
}

const SaveCalculationModal: React.FC<SaveCalculationModalProps> = ({
  open,
  onClose,
  onSuccess,
  calculationResult,
  currentMethod,
  laboratoryId,
  departmentId,
}) => {
  const queryClient = useQueryClient();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [executorSearch, setExecutorSearch] = useState('');
  const [executorLoading, setExecutorLoading] = useState(false);
  const [executorOptions, setExecutorOptions] = useState<
    Array<{ hashMd5: string; fullName: string }>
  >([]);
  const [selectedExecutor, setSelectedExecutor] = useState<{
    hashMd5: string;
    fullName: string;
  } | null>(null);
  const [selectedSample, setSelectedSample] = useState<{
    id: number;
    registration_number: string;
    test_object: string;
  } | null>(null);
  const [samples, setSamples] = useState<
    Array<{ id: number; registration_number: string; test_object: string }>
  >([]);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isSampleDropdownVisible, setIsSampleDropdownVisible] = useState(false);
  const [sampleDropdownStyle, setSampleDropdownStyle] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createCalculationMutation = useMutation({
    mutationFn: (data: Parameters<typeof calculationApi.createCalculation>[0]) =>
      calculationApi.createCalculation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calculations'] });
      message.success('Расчет успешно сохранен');
      handleClose();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: unknown) => {
      console.error('Ошибка при сохранении расчета:', error);
      setErrors({
        general: 'Произошла ошибка при сохранении результата расчета',
      });
    },
  });

  const updateSampleDropdownPosition = useCallback(() => {
    if (!searchContainerRef.current) {
      return;
    }

    const rect = searchContainerRef.current.getBoundingClientRect();
    const scrollY = window.scrollY ?? window.pageYOffset ?? document.documentElement.scrollTop ?? 0;
    const scrollX =
      window.scrollX ?? window.pageYOffset ?? document.documentElement.scrollLeft ?? 0;
    const width = Math.min(rect.width, 558);

    setSampleDropdownStyle({
      top: rect.bottom + scrollY,
      left: rect.left + scrollX,
      width,
    });
  }, []);

  const searchSamples = useCallback(
    async (searchText: string) => {
      if (!searchText) {
        setSamples([]);
        return;
      }

      setSamplesLoading(true);
      try {
        const response = await sampleApi.listSamples({
          laboratory_id: laboratoryId,
          department_id: departmentId,
          search: searchText,
          page: 1,
          page_size: 10,
        });
        setSamples(response.items);
      } catch (error) {
        console.error('Ошибка при поиске проб:', error);
        message.error('Не удалось загрузить список проб');
      } finally {
        setSamplesLoading(false);
      }
    },
    [laboratoryId, departmentId]
  );

  const handleSampleSelect = useCallback(async (sampleId: number) => {
    try {
      const sample = await sampleApi.getSample(sampleId);
      setSelectedSample({
        id: sample.id,
        registration_number: sample.registration_number,
        test_object: sample.test_object,
      });
      setSamples([]);
      setIsSampleDropdownVisible(false);
      setSearchValue(sample.registration_number);
    } catch (error) {
      console.error('Ошибка при загрузке пробы:', error);
      message.error('Не удалось загрузить данные пробы');
    }
  }, []);

  useEffect(() => {
    if (open) {
      setExecutorSearch('');
      setSelectedExecutor(null);
      setSelectedSample(null);
      setSamples([]);
      setSearchValue('');
      setErrors({});
    }
  }, [open]);

  useEffect(() => {
    const shouldShow = open && samples.length > 0 && !selectedSample;
    setIsSampleDropdownVisible(shouldShow);

    if (shouldShow) {
      updateSampleDropdownPosition();
    }
  }, [open, samples, selectedSample, updateSampleDropdownPosition]);

  useEffect(() => {
    if (!isSampleDropdownVisible) {
      return;
    }

    const handlePositionUpdate = () => {
      updateSampleDropdownPosition();
    };

    window.addEventListener('resize', handlePositionUpdate);
    window.addEventListener('scroll', handlePositionUpdate, true);

    return () => {
      window.removeEventListener('resize', handlePositionUpdate);
      window.removeEventListener('scroll', handlePositionUpdate, true);
    };
  }, [isSampleDropdownVisible, updateSampleDropdownPosition]);

  const handleSave = useCallback(() => {
    const validate = (): boolean => {
      const newErrors: Record<string, string> = {};

      if (!selectedSample) {
        newErrors.sample = 'Выберите пробу';
      }

      if (!selectedExecutor) {
        newErrors.executor = 'Выберите исполнителя из списка';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    if (!validate() || !currentMethod || !selectedSample || !selectedExecutor) {
      return;
    }

    if (!calculationResult.laboratory_activity_date) {
      setErrors({
        general: 'Необходимо указать дату лабораторной деятельности',
      });
      return;
    }

    createCalculationMutation.mutate({
      sample_id: selectedSample.id,
      laboratory_id: laboratoryId,
      department_id: departmentId,
      research_method_id: currentMethod.id,
      input_data: calculationResult.input_data,
      equipment_data: currentMethod.equipment_data_default || [],
      result: calculationResult.result,
      executor: selectedExecutor.hashMd5,
      measurement_error: calculationResult.measurement_error || undefined,
      unit: currentMethod.unit,
      laboratory_activity_date: calculationResult.laboratory_activity_date.format('YYYY-MM-DD'),
    });
  }, [
    currentMethod,
    selectedSample,
    selectedExecutor,
    calculationResult,
    laboratoryId,
    departmentId,
    createCalculationMutation,
  ]);

  const handleClose = useCallback(() => {
    if (!createCalculationMutation.isPending) {
      setErrors({});
      setExecutorSearch('');
      setSelectedExecutor(null);
      setSelectedSample(null);
      setSamples([]);
      setSearchValue('');
      setIsSampleDropdownVisible(false);
      onClose();
    }
  }, [createCalculationMutation.isPending, onClose]);

  const handleExecutorSearch = useCallback(async (value: string) => {
    setExecutorSearch(value);
    setSelectedExecutor(null);

    if (value.length < 3) {
      setExecutorOptions([]);
      return;
    }

    setExecutorLoading(true);
    try {
      const data = await employeesApi.searchByFio(value);
      setExecutorOptions(
        data.map(emp => ({
          hashMd5: emp.hashMd5 || emp.hash_md5 || '',
          fullName: emp.fullName || emp.full_name || '',
        }))
      );
    } catch (err) {
      console.error('Ошибка при поиске сотрудников:', err);
      message.error('Не удалось загрузить список сотрудников');
    } finally {
      setExecutorLoading(false);
    }
  }, []);

  if (!open) return null;

  const sampleDropdown =
    isSampleDropdownVisible && (samplesLoading || samples.length > 0)
      ? createPortal(
          <div
            className="sample-dropdown sample-dropdown-portal"
            style={{
              top: `${sampleDropdownStyle.top}px`,
              left: `${sampleDropdownStyle.left}px`,
              width: `${sampleDropdownStyle.width}px`,
            }}
          >
            {samplesLoading ? (
              <div className="sample-loading">
                <Spin size="small" />
              </div>
            ) : (
              samples.map(sample => (
                <div
                  key={sample.id}
                  className="sample-option"
                  onClick={() => {
                    handleSampleSelect(sample.id);
                  }}
                >
                  {sample.registration_number} - {sample.test_object}
                </div>
              ))
            )}
          </div>,
          document.body
        )
      : null;

  if (!open) return null;

  return (
    <Modal
      header="Сохранение результата расчета"
      onClose={handleClose}
      onCancel={handleClose}
      onSave={handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      style={{ width: '600px' }}
    >
      <div className="save-calculation-form">
        <div className="form-item">
          <label className="form-label">
            Исполнитель <span className="required">*</span>
          </label>
          <div className="executor-search-container">
            <Input
              value={executorSearch}
              placeholder="Введите ФИО исполнителя"
              readOnly={!!selectedExecutor}
              onChange={e => handleExecutorSearch(e.target.value)}
              suffix={
                selectedExecutor ? (
                  <CloseCircleFilled
                    style={{ color: '#ff4d4f', cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedExecutor(null);
                      setExecutorSearch('');
                      setExecutorOptions([]);
                    }}
                  />
                ) : null
              }
            />
            {executorOptions.length > 0 && !selectedExecutor && (
              <div className="executor-dropdown">
                {executorLoading ? (
                  <div className="executor-loading">
                    <Spin size="small" />
                  </div>
                ) : (
                  executorOptions.map(emp => (
                    <div
                      key={emp.hashMd5}
                      className="executor-option"
                      onClick={() => {
                        setSelectedExecutor(emp);
                        setExecutorSearch(emp.fullName);
                        setExecutorOptions([]);
                        setErrors(prev => ({ ...prev, executor: undefined }));
                      }}
                    >
                      {emp.fullName}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          {errors.executor && <div className="error-message">{errors.executor}</div>}
        </div>

        <div className="form-item">
          <label className="form-label">
            Регистрационный номер пробы <span className="required">*</span>
          </label>
          <div className="sample-search-container" ref={searchContainerRef}>
            <Input
              value={searchValue}
              placeholder="Введите регистрационный номер пробы"
              onChange={e => {
                const value = e.target.value;
                setSearchValue(value);
                searchSamples(value);
                if (selectedSample) {
                  setSelectedSample(null);
                }
              }}
            />
          </div>
          {errors.sample && <div className="error-message">{errors.sample}</div>}
        </div>

        {errors.general && <div className="error-message general-error">{errors.general}</div>}
      </div>
      {sampleDropdown}
    </Modal>
  );
};

export default SaveCalculationModal;
