import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { CreateResearchMethodModal } from '../../features/Modals';
import { calculationApi } from '../../shared/api/calculation';
import { laboratoryApi } from '../../shared/api/laboratory';
import { researchApi } from '../../shared/api/research';
import Layout from '../../shared/ui/Layout/Layout';
import { CalculationsTable } from '../../widgets/CalculationsTable';
import { NavigationBar } from '../../widgets/NavigationBar';
import { ResearchMethodsList } from '../../widgets/ResearchMethodsList';
import './AdminPage.css';

function AdminPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const laboratoryId = searchParams.get('laboratory_id');
  const departmentId = searchParams.get('department_id');
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [isCreateMethodModalOpen, setIsCreateMethodModalOpen] = useState(false);

  // Загрузка лаборатории/подразделения
  const { data: laboratoryData } = useQuery({
    queryKey: ['laboratory', laboratoryId],
    queryFn: () => laboratoryApi.getLaboratory(Number(laboratoryId!)),
    enabled: !!laboratoryId,
  });

  // Загрузка методов исследования
  const { data: methodsData, isLoading: isLoadingMethods } = useQuery({
    queryKey: ['research-methods', laboratoryId, departmentId],
    queryFn: () =>
      researchApi.listResearchMethods({
        laboratory_id: laboratoryId ? Number(laboratoryId) : undefined,
        department_id: departmentId ? Number(departmentId) : undefined,
        page: 1,
        page_size: 100,
      }),
    enabled: !!(laboratoryId || departmentId),
  });

  // Загрузка расчетов
  const { data: calculationsData, isLoading: isLoadingCalculations } = useQuery({
    queryKey: ['calculations', laboratoryId, departmentId, selectedMethodId],
    queryFn: () =>
      calculationApi.listCalculations({
        laboratory_id: laboratoryId ? Number(laboratoryId) : undefined,
        department_id: departmentId ? Number(departmentId) : undefined,
        research_method_id: selectedMethodId || undefined,
        page: 1,
        page_size: 50,
      }),
    enabled: !!(laboratoryId || departmentId),
  });

  const methods = useMemo(() => methodsData?.items || [], [methodsData?.items]);
  const calculations = calculationsData?.items || [];

  // Выбираем первый метод по умолчанию
  useEffect(() => {
    if (methods.length > 0 && !selectedMethodId) {
      setSelectedMethodId(methods[0].id);
    }
  }, [methods, selectedMethodId]);

  const selectedMethod = methods.find(m => m.id === selectedMethodId);

  if (!laboratoryId && !departmentId) {
    return (
      <div className="admin-page-wrapper">
        <Layout title="Администрирование">
          <div className="admin-page-error">
            <p>Не указаны параметры лаборатории или подразделения</p>
            <button onClick={() => navigate('/')}>Вернуться на главную</button>
          </div>
        </Layout>
      </div>
    );
  }

  const pageTitle = departmentId
    ? `${laboratoryData?.name || ''} - Подразделение`
    : laboratoryData?.name || 'Администрирование';

  const breadcrumbs = [
    { label: 'Администрирование' },
    ...(laboratoryData
      ? [
          {
            label: laboratoryData.name,
            ...(departmentId ? {} : { onClick: () => navigate('/') }),
          },
        ]
      : []),
    ...(departmentId && laboratoryData ? [{ label: 'Подразделение' }] : []),
  ];

  return (
    <div className="admin-page-wrapper">
      <Layout title={pageTitle}>
        <div className="admin-page-container">
          <NavigationBar breadcrumbs={breadcrumbs} showBack={false} />
          {/* Левая панель - методы исследования */}
          <div className="admin-page-left-panel">
            <ResearchMethodsList
              methods={methods}
              isLoading={isLoadingMethods}
              selectedMethodId={selectedMethodId}
              onMethodSelect={setSelectedMethodId}
              onAddClick={() => setIsCreateMethodModalOpen(true)}
              laboratoryId={laboratoryId ? Number(laboratoryId) : undefined}
              departmentId={departmentId ? Number(departmentId) : undefined}
            />
          </div>

          {/* Правая панель - расчеты */}
          <div className="admin-page-right-panel">
            <CalculationsTable
              calculations={calculations}
              isLoading={isLoadingCalculations}
              selectedMethod={selectedMethod}
              laboratoryId={Number(laboratoryId!)}
              departmentId={departmentId ? Number(departmentId) : undefined}
              onAddClick={() => {
                message.info('Функция добавления расчета будет добавлена');
              }}
            />
          </div>
        </div>
      </Layout>

      <CreateResearchMethodModal
        isOpen={isCreateMethodModalOpen}
        onClose={() => setIsCreateMethodModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['research-methods'] });
        }}
        laboratoryId={laboratoryId ? Number(laboratoryId) : undefined}
        departmentId={departmentId ? Number(departmentId) : undefined}
      />
    </div>
  );
}

export default AdminPage;
