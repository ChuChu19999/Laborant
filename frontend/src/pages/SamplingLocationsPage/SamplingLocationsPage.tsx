import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BankOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import AddIcon from '@mui/icons-material/Add';
import { IconButton } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { LoadingCard } from '../../features/Cards';
import {
  CreateBranchModal,
  EditBranchModal,
  DeleteBranchModal,
  CreateSamplingLocationModal,
  EditSamplingLocationModal,
  DeleteSamplingLocationModal,
} from '../../features/Modals';
import { laboratoriesApi, type Department, type Laboratory } from '../../shared/api/laboratories';
import {
  samplingLocationsApi,
  type Branch,
  type SamplingLocation,
} from '../../shared/api/samplingLocations';
import { useAutoRefetchQuery } from '../../shared/model/lib/useQuery';
import Button from '../../shared/ui/Button/Button';
import { DepartmentCard, LaboratoryCard } from '../../shared/ui/Cards';
import Layout from '../../shared/ui/Layout/Layout';
import { NavigationBar } from '../../widgets/NavigationBar';
import { SplitPanel } from '../../widgets/SplitPanel';
import './SamplingLocationsPage.css';

const SamplingLocationsPage: React.FC = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<SamplingLocation | null>(null);
  const [branchForModal, setBranchForModal] = useState<Branch | null>(null);
  const [isCreateBranchModalOpen, setIsCreateBranchModalOpen] = useState(false);
  const [isEditBranchModalOpen, setIsEditBranchModalOpen] = useState(false);
  const [isDeleteBranchModalOpen, setIsDeleteBranchModalOpen] = useState(false);
  const [isCreateLocationModalOpen, setIsCreateLocationModalOpen] = useState(false);
  const [isEditLocationModalOpen, setIsEditLocationModalOpen] = useState(false);
  const [isDeleteLocationModalOpen, setIsDeleteLocationModalOpen] = useState(false);

  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;

  const { data: laboratories } = useAutoRefetchQuery<{ items: Laboratory[] }>(
    ['sampling-locations', 'laboratories'],
    () => laboratoriesApi.getLaboratories({ page: 1, page_size: 100 }),
    {
      enabled: !labId,
    }
  );

  const { data: laboratory } = useAutoRefetchQuery<Laboratory>(
    ['sampling-locations', 'laboratory', labId],
    () => laboratoriesApi.getLaboratory(labId!),
    {
      enabled: !!labId,
    }
  );

  const { data: departments } = useAutoRefetchQuery<Department[]>(
    ['sampling-locations', 'departments', labId],
    () => laboratoriesApi.getDepartmentsByLaboratory(labId!),
    {
      enabled: !!labId,
    }
  );

  const department = useMemo(() => {
    if (!deptId || !departments) return null;
    return departments.find(dept => dept.id === deptId) || null;
  }, [deptId, departments]);

  const { data: branches } = useAutoRefetchQuery<{ items: Branch[] }>(
    ['sampling-locations', 'branches', labId, deptId],
    () =>
      samplingLocationsApi.getBranches(labId, deptId, {
        sort_by: 'name',
        sort_order: 'asc',
      }),
    {
      enabled: !!labId,
    }
  );

  const { data: samplingLocationsData } = useAutoRefetchQuery<{ items: SamplingLocation[] }>(
    ['sampling-locations', 'items', selectedBranch?.id],
    () =>
      samplingLocationsApi.getSamplingLocations(selectedBranch?.id, {
        sort_by: 'name',
        sort_order: 'asc',
      }),
    {
      enabled: !!selectedBranch?.id,
    }
  );

  const laboratoriesList = laboratories?.items ?? [];
  const departmentsList = (departments ?? []).filter((d: Department) => !d.deleted_at) ?? [];
  const branchesList = branches?.items?.filter((b: Branch) => !b.deleted_at) ?? [];
  const samplingLocations =
    samplingLocationsData?.items?.filter((l: SamplingLocation) => !l.deleted_at) ?? [];

  const previousLabIdRef = useRef<number | undefined>(undefined);
  const previousDeptIdRef = useRef<number | undefined>(undefined);
  const shouldAutoSelectRef = useRef<boolean>(false);

  useEffect(() => {
    if (labId !== previousLabIdRef.current || deptId !== previousDeptIdRef.current) {
      setSelectedBranch(null);
      shouldAutoSelectRef.current = true;
    }
    previousLabIdRef.current = labId;
    previousDeptIdRef.current = deptId;
  }, [labId, deptId]);

  useEffect(() => {
    const availableBranches = branches?.items?.filter((b: Branch) => !b.deleted_at) ?? [];
    if (availableBranches.length > 0 && !selectedBranch && shouldAutoSelectRef.current) {
      setSelectedBranch(availableBranches[0]);
      shouldAutoSelectRef.current = false;
    }
  }, [branches?.items, selectedBranch]);

  const handleLaboratoryClick = (laboratory: Laboratory) => {
    navigate(`/sampling-locations/laboratory/${laboratory.id}`);
  };

  const handleDepartmentClick = (department: Department) => {
    if (labId) {
      navigate(`/sampling-locations/laboratory/${labId}/department/${department.id}`);
    }
  };

  const handleBack = () => {
    if (deptId && labId) {
      navigate(`/sampling-locations/laboratory/${labId}`);
    } else if (labId) {
      navigate('/sampling-locations');
    } else {
      navigate('/');
    }
  };

  const refetchBranches = () => {
    queryClient.invalidateQueries({ queryKey: ['sampling-locations', 'branches'] });
  };

  const refetchLocations = () => {
    queryClient.invalidateQueries({ queryKey: ['sampling-locations', 'items'] });
  };

  const handleCreateBranchSuccess = () => {
    setIsCreateBranchModalOpen(false);
    refetchBranches();
  };

  const handleEditBranch = (branch: Branch) => {
    setBranchForModal(branch);
    setIsEditBranchModalOpen(true);
  };

  const handleEditBranchSuccess = () => {
    setIsEditBranchModalOpen(false);
    setBranchForModal(null);
    refetchBranches();
  };

  const handleDeleteBranch = (branch: Branch) => {
    setBranchForModal(branch);
    setIsDeleteBranchModalOpen(true);
  };

  const handleDeleteBranchSuccess = () => {
    setIsDeleteBranchModalOpen(false);
    const availableBranches = branches?.items?.filter((b: Branch) => !b.deleted_at) ?? [];
    if (selectedBranch && !availableBranches.find(b => b.id === selectedBranch.id)) {
      if (availableBranches.length > 0) {
        setSelectedBranch(availableBranches[0]);
      } else {
        setSelectedBranch(null);
      }
    }
    refetchBranches();
    refetchLocations();
  };

  const handleCreateLocationSuccess = () => {
    setIsCreateLocationModalOpen(false);
    refetchLocations();
  };

  const handleEditLocation = (location: SamplingLocation) => {
    setSelectedLocation(location);
    setIsEditLocationModalOpen(true);
  };

  const handleEditLocationSuccess = () => {
    setIsEditLocationModalOpen(false);
    setSelectedLocation(null);
    refetchLocations();
  };

  const handleDeleteLocation = (location: SamplingLocation) => {
    setSelectedLocation(location);
    setIsDeleteLocationModalOpen(true);
  };

  const handleDeleteLocationSuccess = () => {
    setIsDeleteLocationModalOpen(false);
    setSelectedLocation(null);
    refetchLocations();
  };

  const breadcrumbs = useMemo((): Array<{ label: string; onClick?: () => void }> => {
    const items: Array<{ label: string; onClick?: () => void }> = [
      { label: 'Главная', onClick: () => navigate('/') },
      { label: 'Места отбора проб', onClick: () => navigate('/sampling-locations') },
    ];

    if (laboratory) {
      items.push({
        label: laboratory.name,
        onClick:
          deptId || selectedBranch
            ? () => navigate(`/sampling-locations/laboratory/${labId}`)
            : undefined,
      });
    }

    if (department) {
      items.push({
        label: department.name,
        onClick: selectedBranch
          ? () => navigate(`/sampling-locations/laboratory/${labId}/department/${deptId}`)
          : undefined,
      });
    }

    return items;
  }, [navigate, laboratory, department, labId, deptId, selectedBranch]);

  const isInitialLoading =
    (!labId && !laboratories) ||
    (labId && !laboratory && !departments) ||
    (labId && (deptId || departmentsList.length === 0) && !branches && branchesList.length === 0);

  if (isInitialLoading) {
    return (
      <Layout title="Места отбора проб">
        <NavigationBar breadcrumbs={breadcrumbs} onBack={handleBack} showBack={!!labId} />
        <LoadingCard loading />
      </Layout>
    );
  }

  if (!labId) {
    return (
      <Layout title="Места отбора проб">
        <NavigationBar breadcrumbs={breadcrumbs} onBack={() => navigate('/')} showBack={true} />
        <div className="sampling-locations-laboratories">
          <div className="sampling-locations-laboratories-grid">
            {laboratoriesList.map((laboratory: Laboratory) => (
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

  if (labId && !deptId && departmentsList.length > 0) {
    return (
      <Layout title={laboratory?.name || 'Места отбора проб'}>
        <NavigationBar breadcrumbs={breadcrumbs} onBack={handleBack} showBack={true} />
        <div className="sampling-locations-departments">
          <div className="sampling-locations-departments-grid">
            {departmentsList.map((department: Department, index: number) => (
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

  const title =
    (department && department.name) || (laboratory && laboratory.name) || 'Места отбора проб';

  return (
    <Layout title={title}>
      <NavigationBar breadcrumbs={breadcrumbs} onBack={handleBack} showBack={true} />

      <SplitPanel
        leftPanel={
          <div className="sampling-locations-branches">
            <div className="sampling-locations-branches-header">
              <h3 className="sampling-locations-branches-title">Филиалы</h3>
              <IconButton
                aria-label="добавить филиал"
                size="small"
                className="sampling-locations-branches-add-button"
                onClick={() => setIsCreateBranchModalOpen(true)}
              >
                <AddIcon fontSize="small" className="sampling-locations-branches-add-icon" />
              </IconButton>
            </div>
            <div className="sampling-locations-branches-content">
              {branchesList.length === 0 ? (
                <div className="sampling-locations-empty-text">Нет филиалов</div>
              ) : (
                <div className="sampling-locations-branches-list">
                  {branchesList.map(branch => (
                    <div
                      key={branch.id}
                      className={`sampling-locations-branch-item${
                        selectedBranch?.id === branch.id
                          ? ' sampling-locations-branch-item--active'
                          : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="sampling-locations-branch-item-button"
                        onClick={() => setSelectedBranch(branch)}
                      >
                        <div className="sampling-locations-branch-item-main">
                          <div className="sampling-locations-branch-item-icon">
                            <BankOutlined />
                          </div>
                          <div>
                            <span className="sampling-locations-branch-name">{branch.name}</span>
                            {branch.phone && (
                              <span className="sampling-locations-branch-phone">
                                {branch.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                      <div className="sampling-locations-branch-item-actions">
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={e => {
                            e.stopPropagation();
                            handleEditBranch(branch);
                          }}
                        />
                        <Button
                          type="text"
                          size="small"
                          icon={<DeleteOutlined />}
                          danger
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteBranch(branch);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        }
        rightPanel={
          <div className="sampling-locations-right">
            {!selectedBranch ? (
              <div className="sampling-locations-placeholder">
                <h3>Выберите филиал</h3>
                <p>Выберите филиал слева, чтобы просмотреть места отбора проб.</p>
              </div>
            ) : (
              <div className="sampling-locations-list-wrapper">
                <div className="sampling-locations-list-header">
                  <div>
                    <h3 className="sampling-locations-list-title">{selectedBranch.name}</h3>
                    {selectedBranch.phone && (
                      <p className="sampling-locations-list-subtitle">
                        Телефон: {selectedBranch.phone}
                      </p>
                    )}
                  </div>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    size="small"
                    onClick={() => setIsCreateLocationModalOpen(true)}
                  >
                    Добавить место отбора пробы
                  </Button>
                </div>

                {!samplingLocationsData && selectedBranch ? (
                  <LoadingCard loading />
                ) : samplingLocations.length === 0 ? (
                  <div className="sampling-locations-empty">
                    <h4>Нет мест отбора проб</h4>
                    <p>
                      Добавьте первое место отбора пробы, нажав на кнопку «Добавить место отбора
                      пробы».
                    </p>
                  </div>
                ) : (
                  <div className="sampling-locations-list">
                    {samplingLocations.map(location => (
                      <div key={location.id} className="sampling-locations-item">
                        <div className="sampling-locations-item-main">
                          <div className="sampling-locations-item-icon">
                            <EnvironmentOutlined />
                          </div>
                          <div>
                            <div className="sampling-locations-item-name">{location.name}</div>
                          </div>
                        </div>
                        <div className="sampling-locations-item-actions">
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleEditLocation(location)}
                          />
                          <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            danger
                            onClick={() => handleDeleteLocation(location)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        }
      />

      {labId && (
        <CreateBranchModal
          open={isCreateBranchModalOpen}
          laboratoryId={labId}
          departmentId={deptId}
          onClose={() => setIsCreateBranchModalOpen(false)}
          onSuccess={handleCreateBranchSuccess}
        />
      )}

      <EditBranchModal
        open={isEditBranchModalOpen}
        branch={branchForModal}
        onClose={() => {
          setIsEditBranchModalOpen(false);
          setBranchForModal(null);
        }}
        onSuccess={handleEditBranchSuccess}
      />

      <DeleteBranchModal
        open={isDeleteBranchModalOpen}
        branch={branchForModal}
        onClose={() => {
          setIsDeleteBranchModalOpen(false);
          setBranchForModal(null);
        }}
        onSuccess={handleDeleteBranchSuccess}
      />

      {selectedBranch && (
        <CreateSamplingLocationModal
          open={isCreateLocationModalOpen}
          branchId={selectedBranch.id}
          onClose={() => setIsCreateLocationModalOpen(false)}
          onSuccess={handleCreateLocationSuccess}
        />
      )}

      <EditSamplingLocationModal
        open={isEditLocationModalOpen}
        location={selectedLocation}
        onClose={() => {
          setIsEditLocationModalOpen(false);
          setSelectedLocation(null);
        }}
        onSuccess={handleEditLocationSuccess}
      />

      <DeleteSamplingLocationModal
        open={isDeleteLocationModalOpen}
        location={selectedLocation}
        onClose={() => {
          setIsDeleteLocationModalOpen(false);
          setSelectedLocation(null);
        }}
        onSuccess={handleDeleteLocationSuccess}
      />
    </Layout>
  );
};

export default SamplingLocationsPage;
