import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { PlusOutlined } from '@ant-design/icons';
import { Player } from '@lottiefiles/react-lottie-player';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import packageJson from '../../../package.json';
import { LoadingCard } from '../../features/Cards';
import { CreateLaboratoryModal, CreateDepartmentModal } from '../../features/Modals';
import {
  laboratoryApi,
  type LaboratoryResponse,
  type DepartmentResponse,
} from '../../shared/api/laboratory';
import ChemistryLabAnimation from '../../shared/assets/animations/chemistry-lab.json';
import Bubble from '../../shared/ui/Bubble/Bubble';
import Button from '../../shared/ui/Button/Button';
import {
  LaboratoryCard,
  DepartmentCard,
  AddLaboratoryCard,
  AddDepartmentCard,
} from '../../shared/ui/Card';
import Layout from '../../shared/ui/Layout/Layout';
import { NavigationBar } from '../../widgets/NavigationBar';
import './MainPage.css';

interface MainPageContext {
  minimize?: boolean;
  isAdmin?: boolean;
}

type ViewMode = 'welcome' | 'laboratories' | 'departments';

function MainPage() {
  const { minimize, isAdmin } = (useOutletContext() as MainPageContext) || {};
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('welcome');
  const [selectedLaboratory, setSelectedLaboratory] = useState<LaboratoryResponse | null>(null);
  const [isCreateLaboratoryModalOpen, setIsCreateLaboratoryModalOpen] = useState(false);
  const [isCreateDepartmentModalOpen, setIsCreateDepartmentModalOpen] = useState(false);

  // Запрос списка лабораторий
  const { data: laboratoriesData, isLoading: isLoadingLaboratories } = useQuery({
    queryKey: ['laboratories'],
    queryFn: () => laboratoryApi.listLaboratories({ page: 1, page_size: 100 }),
    enabled: viewMode === 'laboratories' || viewMode === 'departments',
  });

  // Запрос подразделений выбранной лаборатории
  const { data: departmentsData, isLoading: isLoadingDepartments } = useQuery({
    queryKey: ['departments', selectedLaboratory?.id],
    queryFn: () => laboratoryApi.getDepartmentsByLaboratory(selectedLaboratory!.id),
    enabled: viewMode === 'departments' && selectedLaboratory !== null,
  });

  const handleShowLaboratories = () => {
    setViewMode('laboratories');
    setSelectedLaboratory(null);
  };

  const handleLaboratoryClick = (laboratory: LaboratoryResponse) => {
    setSelectedLaboratory(laboratory);
    setViewMode('departments');
  };

  const handleDepartmentClick = (department: DepartmentResponse) => {
    // Переход на AdminPage для подразделения
    navigate(`/admin?laboratory_id=${selectedLaboratory?.id}&department_id=${department.id}`);
  };

  const handleBack = () => {
    if (viewMode === 'departments') {
      setViewMode('laboratories');
      setSelectedLaboratory(null);
    } else {
      setViewMode('welcome');
    }
  };

  const handleHome = () => {
    setViewMode('welcome');
    setSelectedLaboratory(null);
  };

  if (viewMode === 'welcome') {
    return (
      <div className="main-page-wrapper">
        <Layout title="Главная">
          <div
            className={`main-page-container ${minimize ? 'sidebar-collapsed' : 'sidebar-expanded'}`}
          >
            <div className="welcome-content">
              <div className="welcome-text-content">
                <div className="welcome-bubbles">
                  <Bubble text={`Версия ${packageJson.version}`} color="#619BEF" textColor="#fff" />
                  {isAdmin && <Bubble text="Администратор" color="#1677ff" textColor="#fff" />}
                </div>
                <h1 className="welcome-title">Лаборант ФХИ</h1>
                <p className="welcome-subtitle">
                  Система управления физико-химическими испытаниями и лабораторной документацией
                </p>
                {isAdmin && (
                  <div className="welcome-actions">
                    <Button
                      type="primary"
                      onClick={handleShowLaboratories}
                      buttonColor="#0066cc"
                      wrapperStyle="admin-button"
                    >
                      Управление лабораториями
                    </Button>
                  </div>
                )}
              </div>
              <div className="welcome-animation">
                <div className="animation-wrapper">
                  <Player
                    autoplay
                    loop
                    src={ChemistryLabAnimation}
                    className="lottie-player"
                    rendererSettings={{
                      preserveAspectRatio: 'xMidYMid meet',
                      clearCanvas: true,
                      progressiveLoad: false,
                      hideOnTransparent: true,
                      renderer: 'svg',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Layout>
      </div>
    );
  }

  if (viewMode === 'laboratories') {
    const laboratories = laboratoriesData?.items || [];
    const isLoading = isLoadingLaboratories;

    if (isLoading) {
      return (
        <div className="main-page-wrapper">
          <Layout title="Управление лабораториями">
            <div className="laboratories-container" style={{ position: 'relative' }}>
              <LoadingCard loading={isLoading} />
            </div>
          </Layout>
        </div>
      );
    }

    return (
      <div className="main-page-wrapper">
        <Layout title="Управление лабораториями">
          <div className="laboratories-container">
            <NavigationBar
              breadcrumbs={[
                { label: 'Главная страница', onClick: handleHome },
                { label: 'Управление лабораториями' },
              ]}
              onBack={handleHome}
              onHomeClick={handleHome}
              showBack={false}
            />

            <div className="laboratories-grid">
              {Array.isArray(laboratories) &&
                laboratories.map(laboratory => (
                  <LaboratoryCard
                    key={laboratory.id}
                    laboratory={laboratory}
                    onClick={handleLaboratoryClick}
                    showActions={false}
                  />
                ))}
              {Array.isArray(laboratories) && laboratories.length > 0 && (
                <AddLaboratoryCard onClick={() => setIsCreateLaboratoryModalOpen(true)} />
              )}
              {(!Array.isArray(laboratories) || laboratories.length === 0) && (
                <div className="no-laboratories">
                  <p>Лаборатории не найдены</p>
                  <Button
                    type="primary"
                    onClick={() => setIsCreateLaboratoryModalOpen(true)}
                    buttonColor="#0066cc"
                    icon={<PlusOutlined />}
                  >
                    Добавить первую лабораторию
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Layout>
      </div>
    );
  }

  if (viewMode === 'departments' && selectedLaboratory) {
    const departments = departmentsData || [];
    const isLoading = isLoadingDepartments;

    if (isLoading) {
      return (
        <div className="main-page-wrapper">
          <Layout title={selectedLaboratory.name}>
            <div style={{ position: 'relative' }}>
              <LoadingCard loading={isLoading} />
            </div>
          </Layout>
        </div>
      );
    }

    return (
      <div className="main-page-wrapper">
        <Layout title={selectedLaboratory.name}>
          <div className="departments-container">
            <NavigationBar
              breadcrumbs={[
                { label: 'Главная страница', onClick: handleHome },
                { label: 'Управление лабораториями', onClick: handleBack },
                { label: selectedLaboratory.name },
              ]}
              onBack={handleBack}
              onHomeClick={handleHome}
            />

            <div className="departments-grid">
              {departments.map((department, index) => (
                <DepartmentCard
                  key={department.id}
                  department={department}
                  onClick={handleDepartmentClick}
                  showActions={false}
                  iconIndex={index}
                />
              ))}
              {departments.length > 0 && (
                <AddDepartmentCard onClick={() => setIsCreateDepartmentModalOpen(true)} />
              )}
              {departments.length === 0 && (
                <div className="no-departments">
                  <p>Подразделения не найдены</p>
                  <Button
                    type="primary"
                    onClick={() => setIsCreateDepartmentModalOpen(true)}
                    buttonColor="#0066cc"
                    icon={<PlusOutlined />}
                  >
                    Добавить первое подразделение
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Layout>
      </div>
    );
  }

  return (
    <>
      <CreateLaboratoryModal
        isOpen={isCreateLaboratoryModalOpen}
        onClose={() => setIsCreateLaboratoryModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['laboratories'] });
        }}
      />
      {selectedLaboratory && (
        <CreateDepartmentModal
          isOpen={isCreateDepartmentModalOpen}
          onClose={() => setIsCreateDepartmentModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['departments', selectedLaboratory.id] });
          }}
          laboratoryId={selectedLaboratory.id}
        />
      )}
    </>
  );
}

export default MainPage;
