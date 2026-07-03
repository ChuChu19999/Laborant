import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Spin, message } from 'antd';
import { LoadingCard } from '../../features/Cards';
import { SaveCalculationModal, MethodologyVersionChoiceModal } from '../../features/Modals';
import {
  calculationApi,
  type Calculation,
  type CalculationResult,
  type MethodologyChoice,
} from '../../shared/api/calculation';
import { laboratoriesApi } from '../../shared/api/laboratories';
import { researchApi } from '../../shared/api/research';
import { samplesApi, type Sample } from '../../shared/api/samples';
import { extractErrorMessage } from '../../shared/lib/errors/extractErrorMessage';
import { useAutoRefetchQuery } from '../../shared/model/lib/useQuery';
import { Select } from '../../shared/ui/FormItems';
import Layout from '../../shared/ui/Layout/Layout';
import {
  buildAvailableMethodsFromResearchMethod,
  buildCalculationFormPrefill,
} from '../../shared/utils/calculationFormPrefill';
import { getFirstGroupMethodId, sortGroupMethods } from '../../shared/utils/researchMethodGroup';
import { CalculationPanel } from '../../widgets/CalculationPanel';
import { NavigationBar } from '../../widgets/NavigationBar';
import { SplitPanel } from '../../widgets/SplitPanel';
import type { ResearchMethod } from '../../shared/api/research';
import type { Dayjs } from 'dayjs';
import './CalculationsPage.css';

const { Option } = Select;

interface AvailableMethod {
  id: number | string;
  name: string;
  is_group?: boolean;
  group_id?: number;
  methods?: Array<{
    id: number;
    name: string;
    input_data?: ResearchMethod['input_data'];
    intermediate_data?: ResearchMethod['intermediate_data'];
    unit?: string;
    equipment_data_default?: number[];
    sort_order?: number;
  }>;
  input_data?: ResearchMethod['input_data'];
  intermediate_data?: ResearchMethod['intermediate_data'];
  unit?: string;
  equipment_data_default?: number[];
  sort_order?: number;
}

const CalculationsPage: React.FC = () => {
  const { laboratoryId, departmentId, sampleId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
    sampleId?: string;
  }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableMethods, setAvailableMethods] = useState<AvailableMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [currentMethod, setCurrentMethod] = useState<ResearchMethod | null>(null);
  const [lastCalculationResult, setLastCalculationResult] = useState<
    Record<
      number,
      {
        input_data: Record<string, unknown>;
        result: string;
        result_display?: string;
        measurement_error?: string;
        unit?: string;
        convergence?: string;
        laboratory_activity_date: Dayjs | null;
        equipment_data?: number[];
      }
    >
  >({});
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [methodologyChoiceModalOpen, setMethodologyChoiceModalOpen] = useState(false);
  const [methodologyChoice, setMethodologyChoice] = useState<MethodologyChoice | null>(null);
  const [editMethodologyVersion, setEditMethodologyVersion] = useState<'stored' | 'current' | null>(
    null
  );

  // Получаем параметры из URL или из query параметров (для обратной совместимости)
  const labId = laboratoryId
    ? parseInt(laboratoryId, 10)
    : searchParams.get('laboratory_id')
      ? parseInt(searchParams.get('laboratory_id')!, 10)
      : undefined;
  const deptId = departmentId
    ? parseInt(departmentId, 10)
    : searchParams.get('department_id')
      ? parseInt(searchParams.get('department_id')!, 10)
      : undefined;
  const sampleIdNum = sampleId
    ? parseInt(sampleId, 10)
    : searchParams.get('sampleId')
      ? parseInt(searchParams.get('sampleId')!, 10)
      : undefined;

  const editCalculationIdRaw = searchParams.get('editCalculationId');
  const editCalculationId =
    editCalculationIdRaw !== null && editCalculationIdRaw !== ''
      ? parseInt(editCalculationIdRaw, 10)
      : undefined;
  const isEditMode = typeof editCalculationId === 'number' && !Number.isNaN(editCalculationId);

  const [editCalculation, setEditCalculation] = useState<Calculation | null>(null);

  const { data: sample, isLoading: isLoadingSample } = useAutoRefetchQuery<Sample>(
    ['sample', sampleIdNum],
    () => samplesApi.getSample(sampleIdNum!),
    {
      enabled: !!sampleIdNum,
    }
  );

  const { data: laboratories } = useAutoRefetchQuery<
    Awaited<ReturnType<typeof laboratoriesApi.getLaboratories>>
  >(['laboratories'], () => laboratoriesApi.getLaboratories(), {
    enabled: !!labId,
  });

  const { data: departments } = useAutoRefetchQuery<
    Awaited<ReturnType<typeof laboratoriesApi.getDepartmentsByLaboratory>>
  >(
    ['departments', 'by-laboratory', labId],
    () => laboratoriesApi.getDepartmentsByLaboratory(labId!),
    {
      enabled: !!labId,
    }
  );

  useEffect(() => {
    if (!isEditMode) {
      setEditCalculation(null);
      setMethodologyChoice(null);
      setMethodologyChoiceModalOpen(false);
      setEditMethodologyVersion(null);
    }
  }, [isEditMode]);

  const loadResearchMethodForEdit = useCallback(
    async (methodId: number, includeDeleted: boolean) => {
      const fullMethod = await researchApi.getResearchMethod(methodId, {
        include_deleted: includeDeleted,
      });
      setAvailableMethods(buildAvailableMethodsFromResearchMethod(fullMethod));
      setSelectedMethodId(fullMethod.id);
      setCurrentMethod(fullMethod);
    },
    []
  );

  const handleChooseStoredMethodology = useCallback(async () => {
    if (!methodologyChoice) {
      return;
    }
    try {
      setIsLoading(true);
      setMethodologyChoiceModalOpen(false);
      setEditMethodologyVersion('stored');
      await loadResearchMethodForEdit(methodologyChoice.stored_method_id, true);
      setLastCalculationResult({});
    } catch (error) {
      console.error('Ошибка при загрузке старой методики:', error);
      message.error('Не удалось загрузить старую методику');
      setMethodologyChoiceModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  }, [loadResearchMethodForEdit, methodologyChoice]);

  const handleChooseCurrentMethodology = useCallback(
    async (methodId: number) => {
      try {
        setIsLoading(true);
        setMethodologyChoiceModalOpen(false);
        setEditMethodologyVersion('current');
        await loadResearchMethodForEdit(methodId, false);
        setLastCalculationResult({});
      } catch (error) {
        console.error('Ошибка при загрузке новой методики:', error);
        message.error('Не удалось загрузить актуальную методику');
        setMethodologyChoiceModalOpen(true);
      } finally {
        setIsLoading(false);
      }
    },
    [loadResearchMethodForEdit]
  );

  const handleMethodologyChoiceCancel = useCallback(() => {
    setMethodologyChoiceModalOpen(false);
    if (labId && deptId !== undefined) {
      navigate(`/samples/laboratory/${labId}/department/${deptId}`);
    } else if (labId) {
      navigate(`/samples/laboratory/${labId}`);
    } else {
      navigate('/samples');
    }
  }, [deptId, labId, navigate]);

  useEffect(() => {
    const fetchMethodsOrEditCalculation = async () => {
      if (!labId || !sampleIdNum) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        if (isEditMode && typeof editCalculationId === 'number') {
          const calculation = await calculationApi.getCalculation(editCalculationId);

          if (calculation.sample_id !== sampleIdNum) {
            setError('Расчёт не относится к выбранной пробе');
            return;
          }
          if (calculation.laboratory_id !== labId) {
            setError('Расчёт не относится к выбранной лаборатории');
            return;
          }
          if (
            deptId !== undefined &&
            calculation.department_id != null &&
            calculation.department_id !== deptId
          ) {
            setError('Расчёт не относится к выбранному подразделению');
            return;
          }

          const choice = await calculationApi.getMethodologyChoice(editCalculationId);
          setEditCalculation(calculation);
          setMethodologyChoice(choice);
          setLastCalculationResult({});

          if (choice.methodology_changed) {
            setMethodologyChoiceModalOpen(true);
            setEditMethodologyVersion(null);
            setCurrentMethod(null);
            setSelectedMethodId(null);
            setAvailableMethods([]);
            return;
          }

          setEditMethodologyVersion('stored');
          await loadResearchMethodForEdit(
            calculation.research_method_id,
            choice.stored_method_deleted
          );
          return;
        }

        const response = await researchApi.getAvailableResearchMethods({
          laboratory_id: labId,
          department_id: deptId,
          sample_id: sampleIdNum,
        });

        setAvailableMethods(response.methods || []);
        setEditCalculation(null);

        if (response.methods && response.methods.length > 0) {
          const firstMethod = response.methods[0];
          if (firstMethod.is_group && firstMethod.methods && firstMethod.methods.length > 0) {
            const firstGroupMethodId = getFirstGroupMethodId(firstMethod.methods);
            if (firstGroupMethodId != null) {
              setSelectedMethodId(firstGroupMethodId);
              const fullMethod = await researchApi.getResearchMethod(firstGroupMethodId);
              setCurrentMethod(fullMethod);
            }
          } else if (!firstMethod.is_group && typeof firstMethod.id === 'number') {
            setSelectedMethodId(firstMethod.id);
            const fullMethod = await researchApi.getResearchMethod(firstMethod.id);
            setCurrentMethod(fullMethod);
          }
        }
      } catch (error) {
        console.error('Ошибка при загрузке методов:', error);
        const errorMessage = extractErrorMessage(error, 'Не удалось загрузить методы исследования');
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchMethodsOrEditCalculation();
  }, [labId, deptId, sampleIdNum, isEditMode, editCalculationId, loadResearchMethodForEdit]);

  const calculationFormPrefill = useMemo(() => {
    if (!isEditMode || !editCalculation || !currentMethod || !editMethodologyVersion) {
      return null;
    }
    if (
      editCalculation.research_method_id !== currentMethod.id &&
      editMethodologyVersion !== 'current'
    ) {
      return null;
    }
    return {
      methodId: currentMethod.id,
      ...buildCalculationFormPrefill(currentMethod, editCalculation),
    };
  }, [isEditMode, editCalculation, currentMethod, editMethodologyVersion]);

  const handleMethodClick = async (methodId: number) => {
    try {
      const fullMethod = await researchApi.getResearchMethod(methodId);
      setCurrentMethod(fullMethod);
      setSelectedMethodId(methodId);
    } catch (error) {
      console.error('Ошибка при загрузке метода:', error);
      message.error('Не удалось загрузить метод исследования');
    }
  };

  const handleCalculate = async (
    result: CalculationResult,
    inputData: Record<string, unknown>,
    laboratoryActivityDate: Dayjs | null
  ) => {
    if (!currentMethod) return;

    setLastCalculationResult(prev => ({
      ...prev,
      [currentMethod.id]: {
        input_data: inputData,
        result: result.result || '',
        result_display: result.result_display,
        measurement_error: result.measurement_error,
        unit: result.unit,
        convergence: result.convergence,
        laboratory_activity_date: laboratoryActivityDate,
        equipment_data:
          isEditMode && typeof editCalculationId === 'number'
            ? (prev[currentMethod.id]?.equipment_data ??
              editCalculation?.equipment_data ??
              currentMethod.equipment_data_default)
            : currentMethod.equipment_data_default,
      },
    }));
  };

  const handleLaboratoryActivityDateChange = useCallback(
    (date: Dayjs | null) => {
      setLastCalculationResult(prev => {
        if (!currentMethod) return prev;
        const existing = prev[currentMethod.id];
        if (!existing) return prev;
        return {
          ...prev,
          [currentMethod.id]: {
            ...existing,
            laboratory_activity_date: date,
          },
        };
      });
    },
    [currentMethod]
  );

  const handleOpenSaveModal = () => {
    if (!currentMethod) {
      message.warning('Метод не выбран');
      return;
    }

    const calculationData = lastCalculationResult[currentMethod.id];
    if (!calculationData) {
      message.warning('Нет результатов для сохранения');
      return;
    }

    setIsSaveModalOpen(true);
  };

  const handleSaveSuccess = async () => {
    setIsSaveModalOpen(false);

    if (isEditMode && labId) {
      if (deptId !== undefined) {
        navigate(`/samples/laboratory/${labId}/department/${deptId}`);
      } else {
        navigate(`/samples/laboratory/${labId}`);
      }
      return;
    }

    if (currentMethod) {
      setLastCalculationResult(prev => {
        const newResult = { ...prev };
        delete newResult[currentMethod.id];
        return newResult;
      });
    }

    if (labId && sampleIdNum) {
      try {
        const response = await researchApi.getAvailableResearchMethods({
          laboratory_id: labId,
          department_id: deptId,
          sample_id: sampleIdNum,
        });
        setAvailableMethods(response.methods || []);

        // Если текущий метод больше недоступен, выбираем первый доступный
        if (currentMethod) {
          const isCurrentMethodAvailable = response.methods?.some(method =>
            method.is_group
              ? method.methods?.some(m => m.id === currentMethod.id)
              : method.id === currentMethod.id
          );

          if (!isCurrentMethodAvailable && response.methods && response.methods.length > 0) {
            const firstMethod = response.methods[0];
            if (firstMethod.is_group && firstMethod.methods && firstMethod.methods.length > 0) {
              const firstGroupMethodId = getFirstGroupMethodId(firstMethod.methods);
              if (firstGroupMethodId != null) {
                await handleMethodClick(firstGroupMethodId);
              }
            } else if (!firstMethod.is_group && typeof firstMethod.id === 'number') {
              await handleMethodClick(firstMethod.id);
            }
          }
        }
      } catch (error) {
        console.error('Ошибка при обновлении списка методов:', error);
      }
    }
  };

  const handleBack = () => {
    if (labId && deptId) {
      navigate(`/samples/laboratory/${labId}/department/${deptId}`);
    } else if (labId) {
      navigate(`/samples/laboratory/${labId}`);
    } else {
      navigate('/samples');
    }
  };

  const breadcrumbs = useMemo((): Array<{ label: string; onClick?: () => void }> => {
    const items: Array<{ label: string; onClick?: () => void }> = [
      { label: 'Главная', onClick: () => navigate('/') },
      { label: 'Пробы', onClick: () => navigate('/samples') },
    ];

    if (labId && laboratories?.items) {
      const laboratory = laboratories.items.find(l => l.id === labId);
      if (laboratory) {
        items.push({
          label: laboratory.name,
          onClick: deptId ? () => navigate(`/samples/laboratory/${labId}`) : undefined,
        });
      }
    }

    if (deptId && departments) {
      const department = departments.find(d => d.id === deptId);
      if (department) {
        items.push({
          label: department.name,
          onClick: () => navigate(`/samples/laboratory/${labId}/department/${deptId}`),
        });
      }
    }

    if (sample) {
      items.push({ label: `Проба № ${sample.registration_number}` });
    } else {
      items.push({ label: 'Расчеты' });
    }

    return items;
  }, [labId, deptId, laboratories, departments, navigate, sample]);

  const methods = useMemo(() => {
    const result: ResearchMethod[] = [];
    availableMethods.forEach(method => {
      if (method.is_group && method.methods) {
        method.methods.forEach(m => {
          // Создаем объект ResearchMethod из данных группы.
          // Нужна связка groups, иначе CalculationPanel не распознает метод как «массовую долю нефти»
          // (селект Цвет, блокировка C₁/C₂) — там currentMethod берётся из этого массива, а не из GET по id.
          const groupMeta =
            method.group_id != null ? [{ id: method.group_id, name: method.name }] : [];
          result.push({
            id: m.id,
            name: m.name,
            sample_type: [],
            formula: '',
            measurement_error: { type: 'fixed', value: '' },
            unit: m.unit || '',
            measurement_method: '',
            nd_code: '',
            nd_name: '',
            input_data: m.input_data || { fields: [] },
            intermediate_data: m.intermediate_data || { fields: [] },
            convergence_conditions: { formulas: [] },
            rounding_type: 'decimal',
            rounding_decimal: 0,
            is_group_member: true,
            groups: groupMeta,
            created_at: '',
            updated_at: '',
          });
        });
      } else if (!method.is_group && typeof method.id === 'number') {
        result.push({
          id: method.id,
          name: method.name,
          sample_type: [],
          formula: '',
          measurement_error: { type: 'fixed', value: '' },
          unit: method.unit || '',
          measurement_method: '',
          nd_code: '',
          nd_name: '',
          input_data: method.input_data || { fields: [] },
          intermediate_data: method.intermediate_data || { fields: [] },
          convergence_conditions: { formulas: [] },
          rounding_type: 'decimal',
          rounding_decimal: 0,
          is_group_member: false,
          created_at: '',
          updated_at: '',
        });
      }
    });
    return result;
  }, [availableMethods]);

  const groups = useMemo(() => {
    return availableMethods
      .filter(m => m.is_group)
      .map(m => ({
        id: typeof m.group_id === 'number' ? m.group_id : 0,
        name: m.name,
        methods: sortGroupMethods(
          (m.methods || []).map(method => ({
            id: method.id,
            name: method.name,
            sort_order: method.sort_order,
          }))
        ),
        sort_order: m.sort_order || 0,
        created_at: '',
        updated_at: '',
        deleted_at: undefined,
      }));
  }, [availableMethods]);

  const leftPanel = (
    <div className="calculations-page-left-panel">
      <div className="calculations-page-left-panel-header">
        <h3 className="calculations-page-left-panel-title">Методы исследования</h3>
      </div>
      <div className="calculations-page-left-panel-content">
        {isLoading ? (
          <div className="calculations-page-empty calculations-page-spinner">
            <Spin spinning>
              <div className="calculations-page-spinner-placeholder" />
            </Spin>
          </div>
        ) : availableMethods.length === 0 ? (
          <div className="calculations-page-empty">Нет доступных методов исследования</div>
        ) : (
          <div className="calculations-page-methods-list">
            {availableMethods.map(method => {
              const isActive =
                method.is_group && method.methods
                  ? method.methods.some(m => m.id === selectedMethodId)
                  : method.id === selectedMethodId;

              return (
                <div
                  key={method.id}
                  className={`calculations-page-method-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (method.is_group && method.methods && method.methods.length > 0) {
                      const firstGroupMethodId = getFirstGroupMethodId(method.methods);
                      if (firstGroupMethodId != null) {
                        handleMethodClick(firstGroupMethodId);
                      }
                    } else if (!method.is_group && typeof method.id === 'number') {
                      handleMethodClick(method.id);
                    }
                  }}
                >
                  <span className="calculations-page-method-name">
                    {method.name === 'Фракционный состав (конденсат)'
                      ? 'Конденсат'
                      : method.name === 'Фракционный состав (нефть)'
                        ? 'Нефть'
                        : method.name}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const currentMethodGroup = useMemo(() => {
    if (!currentMethod) return null;
    return groups.find(group => group.methods.some(gm => gm.id === currentMethod.id));
  }, [groups, currentMethod]);

  const groupMethods = useMemo(() => {
    if (!currentMethodGroup) return [];
    return currentMethodGroup.methods;
  }, [currentMethodGroup]);

  const shouldShowGroupSelector = (() => {
    if (!currentMethodGroup) return false;

    // Проверяем, является ли метод одним из исключений
    const isExcludedMethod = groupMethods.some(
      method =>
        method.name === 'Конденсат' ||
        method.name === 'Нефть' ||
        method.name === 'Фракционный состав (конденсат)' ||
        method.name === 'Фракционный состав (нефть)'
    );

    // Если метод не является исключением, показываем селектор даже для одного метода
    if (!isExcludedMethod) {
      return groupMethods.length > 0;
    }

    // Для исключенных методов показываем селектор только если методов больше одного
    return groupMethods.length > 1;
  })();

  const rightPanel = (
    <div className="calculations-page-right-panel">
      {!selectedMethodId || !currentMethod ? (
        <div className="calculations-page-placeholder">
          {methodologyChoiceModalOpen ? (
            <>
              <h3>Выберите версию методики</h3>
              <p>Для продолжения укажите, по старой или новой методике редактировать расчёт.</p>
            </>
          ) : (
            <>
              <h3>Выберите метод исследования</h3>
              <p>Выберите метод исследования слева, чтобы начать расчет.</p>
            </>
          )}
        </div>
      ) : (
        <CalculationPanel
          hasNoMethods={false}
          selectedMethodId={selectedMethodId}
          methods={methods}
          groups={groups}
          calculationFormPrefill={calculationFormPrefill}
          groupSelector={
            shouldShowGroupSelector ? (
              <Select
                value={selectedMethodId}
                onChange={value => {
                  const methodId = typeof value === 'number' ? value : null;
                  if (methodId) {
                    handleMethodClick(methodId);
                  }
                }}
                className="calculations-page-select research-method-select"
              >
                {groupMethods.map(method => (
                  <Option key={method.id} value={method.id}>
                    {method.name}
                  </Option>
                ))}
              </Select>
            ) : undefined
          }
          onCalculate={handleCalculate}
          onSave={handleOpenSaveModal}
          lastCalculationResult={lastCalculationResult[currentMethod.id]}
          onLaboratoryActivityDateChange={handleLaboratoryActivityDateChange}
        />
      )}
    </div>
  );

  if (isLoadingSample) {
    return (
      <Layout title="Расчеты" bodyClassName="calculations-page">
        <NavigationBar breadcrumbs={breadcrumbs} onBack={handleBack} showBack={true} />
        <LoadingCard loading />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Ошибка" bodyClassName="calculations-page">
        <NavigationBar breadcrumbs={breadcrumbs} onBack={handleBack} showBack={true} />
        <div className="calculations-page-error">{error}</div>
      </Layout>
    );
  }

  const title = sample
    ? isEditMode
      ? `Редактирование расчёта — проба № ${sample.registration_number}`
      : `Проба № ${sample.registration_number}`
    : 'Расчеты';

  return (
    <Layout title={title} bodyClassName="calculations-page">
      <NavigationBar breadcrumbs={breadcrumbs} onBack={handleBack} showBack={true} />
      <div
        className={
          isEditMode
            ? 'calculations-page-body calculations-page-split-edit-mode'
            : 'calculations-page-body'
        }
      >
        <SplitPanel leftPanel={leftPanel} rightPanel={rightPanel} />
      </div>

      {currentMethod && lastCalculationResult[currentMethod.id] && (
        <SaveCalculationModal
          open={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          onSuccess={handleSaveSuccess}
          calculationData={{
            input_data: lastCalculationResult[currentMethod.id].input_data,
            result: lastCalculationResult[currentMethod.id].result,
            measurement_error: lastCalculationResult[currentMethod.id].measurement_error,
            unit: lastCalculationResult[currentMethod.id].unit,
          }}
          laboratoryActivityDate={lastCalculationResult[currentMethod.id].laboratory_activity_date}
          sampleId={sampleIdNum!}
          laboratoryId={labId!}
          departmentId={deptId}
          researchMethodId={currentMethod.id}
          researchMethodIncludeDeleted={editMethodologyVersion === 'stored'}
          equipment_data={lastCalculationResult[currentMethod.id].equipment_data}
          editingCalculationId={isEditMode ? editCalculationId : undefined}
          existingEquipmentData={editCalculation?.equipment_data}
          previousExecutorHash={isEditMode ? editCalculation?.executor : undefined}
        />
      )}

      <MethodologyVersionChoiceModal
        open={methodologyChoiceModalOpen}
        choice={methodologyChoice}
        onChooseStored={handleChooseStoredMethodology}
        onChooseCurrent={handleChooseCurrentMethodology}
        onCancel={handleMethodologyChoiceCancel}
      />
    </Layout>
  );
};

export default CalculationsPage;
