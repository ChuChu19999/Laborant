import { useState } from 'react';
import {
  BankOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message, Tooltip } from 'antd';
import { LoadingCard } from '../../features/Cards';
import {
  CreateBranchModal,
  CreateSamplingLocationModal,
  DeleteBranchModal,
  DeleteSamplingLocationModal,
  EditBranchModal,
  EditSamplingLocationModal,
} from '../../features/Modals';
import {
  laboratoryApi,
  type LaboratoryResponse,
  type DepartmentResponse,
  type BranchResponse,
  type SamplingLocationResponse,
} from '../../shared/api/laboratory';
import { LaboratoryCard, DepartmentCard } from '../../shared/ui/Card';
import Layout from '../../shared/ui/Layout/Layout';
import { NavigationBar } from '../../widgets/NavigationBar';
import './SamplingLocationsPage.css';

function SamplingLocationsPage() {
  const queryClient = useQueryClient();
  const [selectedLaboratory, setSelectedLaboratory] = useState<LaboratoryResponse | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentResponse | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<BranchResponse | null>(null);
  const [branchToEdit, setBranchToEdit] = useState<BranchResponse | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCreateLocationModalOpen, setIsCreateLocationModalOpen] = useState(false);
  const [isEditLocationModalOpen, setIsEditLocationModalOpen] = useState(false);
  const [isDeleteLocationModalOpen, setIsDeleteLocationModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<SamplingLocationResponse | null>(null);

  // Запрос списка лабораторий
  const { data: laboratoriesData, isLoading: isLoadingLaboratories } = useQuery({
    queryKey: ['laboratories-sampling-locations'],
    queryFn: () => laboratoryApi.listLaboratories({ page: 1, page_size: 100 }),
  });

  // Запрос подразделений выбранной лаборатории
  const { data: departmentsData, isLoading: isLoadingDepartments } = useQuery({
    queryKey: ['departments-sampling-locations', selectedLaboratory?.id],
    queryFn: () => laboratoryApi.getDepartmentsByLaboratory(selectedLaboratory!.id),
    enabled: !!selectedLaboratory?.id,
  });

  // Запрос филиалов выбранной лаборатории и подразделения
  const { data: branchesData, isLoading: isLoadingBranches } = useQuery({
    queryKey: ['branches-sampling-locations', selectedLaboratory?.id, selectedDepartment?.id],
    queryFn: () =>
      laboratoryApi.listBranches({
        laboratory_id: selectedLaboratory!.id,
        department_id: selectedDepartment?.id,
        page: 1,
        page_size: 100,
      }),
    enabled: !!selectedLaboratory?.id,
  });

  // Запрос мест отбора проб для выбранного филиала
  const { data: samplingLocationsData, isLoading: isLoadingSamplingLocations } = useQuery({
    queryKey: ['sampling-locations', selectedBranch?.id],
    queryFn: () =>
      laboratoryApi.listSamplingLocations({
        branch_id: selectedBranch!.id,
        page: 1,
        page_size: 100,
      }),
    enabled: !!selectedBranch?.id,
  });

  const laboratories = laboratoriesData?.items || [];
  const departments = departmentsData || [];
  const branches = branchesData?.items || [];
  const samplingLocations = samplingLocationsData?.items || [];

  // Мутация для создания филиала
  const createBranchMutation = useMutation({
    mutationFn: (data: {
      name: string;
      phone?: string;
      laboratory_id: number;
      department_id?: number;
    }) => laboratoryApi.createBranch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches-sampling-locations'] });
      setIsCreateModalOpen(false);
      message.success('Филиал успешно создан');
    },
    onError: (error: unknown) => {
      console.error('Ошибка при создании филиала:', error);
      message.error('Ошибка при создании филиала');
    },
  });

  // Мутация для создания места отбора пробы
  const createLocationMutation = useMutation({
    mutationFn: (data: { name: string; branch_id: number }) =>
      laboratoryApi.createSamplingLocation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sampling-locations'] });
      setIsCreateLocationModalOpen(false);
      message.success('Место отбора пробы успешно создано');
    },
    onError: (error: unknown) => {
      console.error('Ошибка при создании места отбора пробы:', error);
      message.error('Ошибка при создании места отбора пробы');
    },
  });

  const handleLaboratoryClick = (laboratory: LaboratoryResponse) => {
    setSelectedLaboratory(laboratory);
    setSelectedDepartment(null);
    setSelectedBranch(null);
  };

  const handleDepartmentClick = (department: DepartmentResponse) => {
    setSelectedDepartment(department);
    setSelectedBranch(null);
  };

  const handleBranchSelect = (branch: BranchResponse) => {
    setSelectedBranch(branch);
  };

  const handleBack = () => {
    if (selectedDepartment && departments.length > 0) {
      setSelectedDepartment(null);
      setSelectedBranch(null);
    } else {
      setSelectedLaboratory(null);
      setSelectedDepartment(null);
      setSelectedBranch(null);
    }
  };

  const handleCreateModalSuccess = (data: {
    name: string;
    phone?: string;
    laboratory_id: number;
    department_id?: number;
  }) => {
    createBranchMutation.mutate(data);
  };

  const handleCreateLocationModalSuccess = (data: { name: string; branch_id: number }) => {
    createLocationMutation.mutate(data);
  };

  const handleEdit = (branch: BranchResponse, event: React.MouseEvent) => {
    event.stopPropagation();
    setBranchToEdit(branch);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (branch: BranchResponse, event: React.MouseEvent) => {
    event.stopPropagation();
    setBranchToEdit(branch);
    setIsDeleteModalOpen(true);
  };

  const handleModalClose = () => {
    setIsDeleteModalOpen(false);
    setIsEditModalOpen(false);
    setIsCreateModalOpen(false);
    setBranchToEdit(null);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['branches-sampling-locations'] });
  };

  const handleLocationEdit = (location: SamplingLocationResponse, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedLocation(location);
    setIsEditLocationModalOpen(true);
  };

  const handleLocationDeleteClick = (
    location: SamplingLocationResponse,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();
    setSelectedLocation(location);
    setIsDeleteLocationModalOpen(true);
  };

  const handleLocationModalClose = () => {
    setIsCreateLocationModalOpen(false);
    setIsEditLocationModalOpen(false);
    setIsDeleteLocationModalOpen(false);
    setSelectedLocation(null);
  };

  const handleLocationSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['sampling-locations'] });
  };

  // Обработка состояний загрузки и условный рендер
  if (isLoadingLaboratories) {
    return (
      <Layout title="Места отбора проб">
        <div style={{ position: 'relative' }}>
          <LoadingCard loading={isLoadingLaboratories} />
        </div>
      </Layout>
    );
  }

  // Выбор лаборатории
  if (!selectedLaboratory) {
    return (
      <Layout title="Места отбора проб">
        <div className="laboratories-container">
          <NavigationBar breadcrumbs={[{ label: 'Места отбора проб' }]} showBack={false} />
          <div className="laboratories-grid">
            {laboratories.map(laboratory => (
              <LaboratoryCard
                key={laboratory.id}
                laboratory={laboratory}
                onClick={handleLaboratoryClick}
                showActions={false}
              />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  // Загрузка подразделений
  if (isLoadingDepartments) {
    return (
      <Layout title={selectedLaboratory.name}>
        <div style={{ position: 'relative' }}>
          <LoadingCard loading={isLoadingDepartments} />
        </div>
      </Layout>
    );
  }

  // Выбор подразделения
  if (departments.length > 0 && !selectedDepartment) {
    return (
      <Layout title={selectedLaboratory.name}>
        <div className="departments-container">
          <NavigationBar
            breadcrumbs={[
              { label: 'Места отбора проб', onClick: () => setSelectedLaboratory(null) },
              { label: selectedLaboratory.name },
            ]}
            onBack={handleBack}
            onHomeClick={() => setSelectedLaboratory(null)}
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
          </div>
        </div>
      </Layout>
    );
  }

  // Загрузка филиалов
  if (isLoadingBranches) {
    return (
      <Layout title={selectedDepartment ? selectedDepartment.name : selectedLaboratory.name}>
        <div style={{ position: 'relative' }}>
          <LoadingCard loading={isLoadingBranches} />
        </div>
      </Layout>
    );
  }

  // Отображение филиалов и точек отбора проб в разделенном виде
  return (
    <Layout title={selectedDepartment ? selectedDepartment.name : selectedLaboratory.name}>
      <NavigationBar
        breadcrumbs={[
          {
            label: 'Места отбора проб',
            onClick: () => {
              setSelectedLaboratory(null);
              setSelectedDepartment(null);
              setSelectedBranch(null);
            },
          },
          {
            label: selectedLaboratory.name,
            onClick: () => {
              setSelectedDepartment(null);
              setSelectedBranch(null);
            },
          },
          ...(selectedDepartment
            ? [{ label: selectedDepartment.name, onClick: () => setSelectedDepartment(null) }]
            : []),
        ]}
        onBack={handleBack}
        onHomeClick={() => {
          setSelectedLaboratory(null);
          setSelectedDepartment(null);
          setSelectedBranch(null);
        }}
      />
      <div style={{ display: 'flex', height: 'calc(100vh - 180px)', fontFamily: 'HeliosCondC' }}>
        {/* Левая панель с филиалами */}
        <div
          style={{
            width: '250px',
            borderRight: '1px solid rgba(44, 82, 130, 0.1)',
            overflowY: 'auto',
            padding: '12px',
            paddingBottom: '0px',
            background: 'linear-gradient(180deg, #f8faff 0%, #f0f5ff 100%)',
            height: 'calc(100% + 16px)',
            position: 'sticky',
            top: 0,
            borderBottomLeftRadius: '20px',
            fontFamily: 'HeliosCondC',
            boxShadow: 'inset -1px 0 2px rgba(44, 82, 130, 0.05)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0px',
              position: 'sticky',
              top: 0,
              background: 'linear-gradient(180deg, #f8faff 0%, #f0f5ff 100%)',
              zIndex: 1,
              paddingTop: '1px',
              paddingBottom: '12px',
              borderBottom: '1px solid rgba(44, 82, 130, 0.1)',
            }}
          >
            <h3
              style={{
                fontSize: '16px',
                color: '#2c5282',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                lineHeight: 1,
                fontWeight: 600,
                fontFamily: 'HeliosCondC',
                flex: 1,
              }}
            >
              Филиалы
            </h3>
            <button
              aria-label="добавить филиал"
              onClick={() => setIsCreateModalOpen(true)}
              style={{
                backgroundColor: 'rgba(44, 82, 130, 0.1)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(44, 82, 130, 0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'rgba(44, 82, 130, 0.1)';
              }}
            >
              <PlusOutlined style={{ fontSize: '16px' }} />
            </button>
          </div>
          {branches.length === 0 ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: '#718096',
                fontSize: '14px',
                fontFamily: 'HeliosCondC',
              }}
            >
              Нет филиалов
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                height: 'calc(100% - 60px)',
                overflowY: 'auto',
                paddingRight: '4px',
                paddingTop: '6px',
              }}
            >
              {branches.map(branch => (
                <div
                  key={branch.id}
                  onClick={() => handleBranchSelect(branch)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: selectedBranch?.id === branch.id ? '#e2e8f0' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease-in-out',
                    boxShadow:
                      selectedBranch?.id === branch.id ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                    border:
                      selectedBranch?.id === branch.id
                        ? '1px solid #cbd5e0'
                        : '1px solid transparent',
                    fontFamily: 'HeliosCondC',
                  }}
                  onMouseEnter={e => {
                    if (selectedBranch?.id !== branch.id) {
                      e.currentTarget.style.backgroundColor = '#edf2f7';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                      e.currentTarget.style.border = '1px solid #e2e8f0';
                    }
                  }}
                  onMouseLeave={e => {
                    if (selectedBranch?.id !== branch.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.border = '1px solid transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <BankOutlined style={{ fontSize: '16px', color: '#2c5282' }} />
                    <span style={{ fontSize: '14px', fontFamily: 'HeliosCondC', color: '#2c5282' }}>
                      {branch.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleEdit(branch, e);
                      }}
                      style={{
                        padding: '2px 6px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <EditOutlined style={{ fontSize: '14px' }} />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteClick(branch, e);
                      }}
                      style={{
                        padding: '2px 6px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <DeleteOutlined style={{ fontSize: '14px', color: '#ff4d4f' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Правая панель с точками отбора проб */}
        <div
          style={{
            flex: 1,
            padding: '16px',
            overflowY: !selectedBranch ? 'hidden' : 'auto',
            position: 'relative',
            width: '100%',
            maxWidth: '100%',
            height: 'calc(100% - 10px)',
            display: !selectedBranch ? 'flex' : 'block',
            alignItems: !selectedBranch ? 'center' : 'stretch',
            justifyContent: !selectedBranch ? 'center' : 'flex-start',
          }}
        >
          {!selectedBranch ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4a5568',
                textAlign: 'center',
                padding: '20px',
              }}
            >
              <h3
                style={{
                  marginBottom: '16px',
                  color: '#2d3748',
                  fontFamily: 'HeliosCondC',
                  fontSize: '18px',
                }}
              >
                Выберите филиал
              </h3>
              <p
                style={{
                  marginBottom: '24px',
                  color: '#718096',
                  fontFamily: 'HeliosCondC',
                  fontSize: '14px',
                }}
              >
                Выберите филиал из списка слева для просмотра точек отбора проб
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  gap: '16px',
                }}
              >
                <h3
                  style={{
                    color: '#2c5282',
                    fontSize: '20px',
                    fontWeight: 600,
                    fontFamily: 'HeliosCondC',
                    flex: 1,
                  }}
                >
                  Точки отбора проб: {selectedBranch.name}
                </h3>
                <Tooltip title="Добавить место отбора пробы">
                  <button
                    aria-label="добавить место отбора пробы"
                    onClick={() => setIsCreateLocationModalOpen(true)}
                    style={{
                      backgroundColor: 'rgba(0, 102, 204, 0.1)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 102, 204, 0.2)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 102, 204, 0.1)';
                    }}
                  >
                    <PlusOutlined style={{ fontSize: '16px', color: '#0066cc' }} />
                  </button>
                </Tooltip>
              </div>

              {isLoadingSamplingLocations ? (
                <LoadingCard loading={isLoadingSamplingLocations} />
              ) : samplingLocations.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 'calc(100% - 100px)',
                    color: '#4a5568',
                    textAlign: 'center',
                    padding: '20px',
                  }}
                >
                  <h3
                    style={{
                      marginBottom: '16px',
                      color: '#2d3748',
                      fontFamily: 'HeliosCondC',
                      fontSize: '18px',
                    }}
                  >
                    Нет точек отбора проб
                  </h3>
                  <p
                    style={{
                      marginBottom: '24px',
                      color: '#718096',
                      fontFamily: 'HeliosCondC',
                      fontSize: '14px',
                    }}
                  >
                    Добавьте первую точку отбора пробы, нажав на кнопку &quot;Добавить место отбора
                    пробы&quot;
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {samplingLocations.map(location => (
                    <div
                      key={location.id}
                      style={{
                        padding: '16px',
                        borderRadius: '8px',
                        backgroundColor: '#f8faff',
                        border: '1px solid rgba(44, 82, 130, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s ease-in-out',
                        fontFamily: 'HeliosCondC',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = '#f0f5ff';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(44, 82, 130, 0.1)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = '#f8faff';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <ExperimentOutlined style={{ fontSize: '20px', color: '#2c5282' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span
                            style={{
                              fontSize: '16px',
                              fontWeight: 600,
                              color: '#2c5282',
                              fontFamily: 'HeliosCondC',
                            }}
                          >
                            {location.name}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Tooltip title="Редактировать">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleLocationEdit(location, e);
                            }}
                            style={{
                              padding: '4px 8px',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.backgroundColor = 'rgba(44, 82, 130, 0.1)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <EditOutlined style={{ fontSize: '16px', color: '#2c5282' }} />
                          </button>
                        </Tooltip>
                        <Tooltip title="Удалить">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleLocationDeleteClick(location, e);
                            }}
                            style={{
                              padding: '4px 8px',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.backgroundColor = 'rgba(255, 77, 79, 0.1)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <DeleteOutlined style={{ fontSize: '16px', color: '#ff4d4f' }} />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <CreateBranchModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateModalSuccess}
        laboratory={selectedLaboratory}
        department={selectedDepartment}
      />

      <EditBranchModal
        isOpen={isEditModalOpen}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        branch={branchToEdit}
      />

      <DeleteBranchModal
        isOpen={isDeleteModalOpen}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        branch={branchToEdit}
      />

      {selectedBranch && (
        <>
          <CreateSamplingLocationModal
            isOpen={isCreateLocationModalOpen}
            onClose={handleLocationModalClose}
            onSuccess={handleCreateLocationModalSuccess}
            branch={selectedBranch}
          />

          <EditSamplingLocationModal
            isOpen={isEditLocationModalOpen}
            onClose={handleLocationModalClose}
            onSuccess={handleLocationSuccess}
            location={selectedLocation}
          />

          <DeleteSamplingLocationModal
            isOpen={isDeleteLocationModalOpen}
            onClose={handleLocationModalClose}
            onSuccess={handleLocationSuccess}
            location={selectedLocation}
          />
        </>
      )}
    </Layout>
  );
}

export default SamplingLocationsPage;
