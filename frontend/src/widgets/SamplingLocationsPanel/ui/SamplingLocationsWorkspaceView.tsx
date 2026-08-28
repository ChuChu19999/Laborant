import { CreateBranchModal } from '@/features/CreateBranchModal';
import { CreateSamplingLocationModal } from '@/features/CreateSamplingLocationModal';
import { CreateWellModeModal } from '@/features/CreateWellModeModal';
import { DeleteBranchModal } from '@/features/DeleteBranchModal';
import { DeleteSamplingLocationModal } from '@/features/DeleteSamplingLocationModal';
import { DeleteWellModeModal } from '@/features/DeleteWellModeModal';
import { EditBranchModal } from '@/features/EditBranchModal';
import { EditSamplingLocationModal } from '@/features/EditSamplingLocationModal';
import { EditWellModeModal } from '@/features/EditWellModeModal';
import { Button } from '@/shared/ui/Button';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BankOutlined,
  EnvironmentOutlined,
  DashboardOutlined,
} from '@/shared/ui/icons';
import { Layout } from '@/shared/ui/Layout';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import { ThreePanel } from '@/shared/ui/ThreePanel';
import type { SamplingLocationsPanelModalsApi } from '../model/useSamplingLocationsPanelModals';
import type { Branch } from '@/entities/Branch';
import type { SamplingLocation } from '@/entities/SamplingLocation';
import type { WellMode } from '@/entities/WellMode';

type BreadcrumbItem = { label: string; onClick?: () => void };

interface SamplingLocationsWorkspaceViewProps {
  title: string;
  breadcrumbs: BreadcrumbItem[];
  onBack: () => void;
  labId: number;
  deptId: number | undefined;
  terminologyLabel: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  selectedBranch: Branch | null;
  onSelectBranch: (branch: Branch) => void;
  branches: Branch[];
  samplingLocations: SamplingLocation[];
  wellModes: WellMode[];
  isSamplingLocationsLoading: boolean;
  isSamplingLocationsPlaceholder: boolean;
  isWellModesLoading: boolean;
  isWellModesPlaceholder: boolean;
  modals: SamplingLocationsPanelModalsApi;
}

const SamplingLocationsWorkspaceView = ({
  title,
  breadcrumbs,
  onBack,
  labId,
  deptId,
  terminologyLabel,
  canCreate,
  canUpdate,
  canDelete,
  selectedBranch,
  onSelectBranch,
  branches,
  samplingLocations,
  wellModes,
  isSamplingLocationsLoading,
  isSamplingLocationsPlaceholder,
  isWellModesLoading,
  isWellModesPlaceholder,
  modals,
}: SamplingLocationsWorkspaceViewProps) => {
  return (
    <Layout title={title}>
      <NavigationBar breadcrumbs={breadcrumbs} onBack={onBack} showBack={true} />

      <ThreePanel
        leftPanel={
          <div className="sampling-locations-branches">
            <div className="sampling-locations-branches-header">
              <h3 className="sampling-locations-branches-title">Филиалы</h3>
              {canCreate && (
                <Button
                  unwrapped
                  aria-label="добавить филиал"
                  type="text"
                  size="small"
                  className="sampling-locations-branches-add-button"
                  onClick={modals.openCreateBranchModal}
                  icon={<PlusOutlined className="sampling-locations-branches-add-icon" />}
                />
              )}
            </div>
            <div className="sampling-locations-branches-content">
              {branches.length === 0 ? (
                <div className="sampling-locations-empty-text">Нет филиалов</div>
              ) : (
                <div className="sampling-locations-branches-list">
                  {branches.map(branch => (
                    <div
                      key={branch.id}
                      className={`sampling-locations-branch-item${
                        selectedBranch?.id === branch.id
                          ? ' sampling-locations-branch-item--active'
                          : ''
                      }`}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectBranch(branch)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectBranch(branch);
                        }
                      }}
                    >
                      <div className="sampling-locations-branch-item-button">
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
                      </div>
                      <div className="sampling-locations-branch-item-actions">
                        {canUpdate && (
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={e => {
                              e.stopPropagation();
                              modals.handleEditBranch(branch);
                            }}
                            className="sampling-locations-edit-button"
                          />
                        )}
                        {canDelete && (
                          <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            danger
                            onClick={e => {
                              e.stopPropagation();
                              modals.handleDeleteBranch(branch);
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        }
        middlePanel={
          <div className="sampling-locations-middle-panel">
            {!selectedBranch ? (
              <div className="sampling-locations-placeholder">
                <h3>добавить филиал</h3>
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
                  <div className="sampling-locations-add-button-container">
                    {canCreate && (
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        size="small"
                        className="sampling-locations-add-button"
                        onClick={modals.openCreateLocationModal}
                      >
                        Добавить место отбора пробы
                      </Button>
                    )}
                  </div>
                </div>

                {isSamplingLocationsLoading && !isSamplingLocationsPlaceholder && selectedBranch ? (
                  <div className="sampling-locations-empty">
                    <LoadingCard loading />
                  </div>
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
                          {canUpdate && (
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => modals.handleEditLocation(location)}
                              className="sampling-locations-edit-button"
                            />
                          )}
                          {canDelete && (
                            <Button
                              type="text"
                              size="small"
                              icon={<DeleteOutlined />}
                              danger
                              onClick={() => modals.handleDeleteLocation(location)}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        }
        rightPanel={
          <div className="sampling-locations-well-modes">
            {!selectedBranch ? (
              <div className="sampling-locations-placeholder">
                <h3>Нет филиалов</h3>
                <p>Выберите филиал слева, чтобы просмотреть {terminologyLabel.toLowerCase()}.</p>
              </div>
            ) : (
              <div className="sampling-locations-list-wrapper">
                <div className="sampling-locations-list-header">
                  <div>
                    <h3 className="sampling-locations-list-title">{terminologyLabel}</h3>
                  </div>
                  <div className="sampling-locations-add-button-container">
                    {canCreate && (
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        size="small"
                        className="sampling-locations-add-button"
                        onClick={modals.openCreateWellModeModal}
                      >
                        Добавить {terminologyLabel.toLowerCase()}
                      </Button>
                    )}
                  </div>
                </div>

                {isWellModesLoading && !isWellModesPlaceholder && selectedBranch ? (
                  <div className="sampling-locations-empty">
                    <LoadingCard loading />
                  </div>
                ) : wellModes.length === 0 ? (
                  <div className="sampling-locations-empty">
                    <h4>Нет {terminologyLabel.toLowerCase()}</h4>
                    <p>
                      Добавьте первую запись, нажав на кнопку «Добавить{' '}
                      {terminologyLabel.toLowerCase()}».
                    </p>
                  </div>
                ) : (
                  <div className="sampling-locations-list">
                    {wellModes.map(wellMode => (
                      <div key={wellMode.id} className="sampling-locations-item">
                        <div className="sampling-locations-item-main">
                          <div className="sampling-locations-item-icon">
                            <DashboardOutlined />
                          </div>
                          <div>
                            <div className="sampling-locations-item-name">{wellMode.name}</div>
                          </div>
                        </div>
                        <div className="sampling-locations-item-actions">
                          {canUpdate && (
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => modals.handleEditWellMode(wellMode)}
                              className="sampling-locations-edit-button"
                            />
                          )}
                          {canDelete && (
                            <Button
                              type="text"
                              size="small"
                              icon={<DeleteOutlined />}
                              danger
                              onClick={() => modals.handleDeleteWellMode(wellMode)}
                            />
                          )}
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

      <CreateBranchModal
        open={modals.isCreateBranchModalOpen}
        laboratoryId={labId}
        departmentId={deptId}
        onClose={modals.closeCreateBranchModal}
        onSuccess={modals.handleCreateBranchSuccess}
      />

      <EditBranchModal
        open={modals.isEditBranchModalOpen}
        branch={modals.branchForModal}
        onClose={modals.closeEditBranchModal}
        onSuccess={modals.handleEditBranchSuccess}
      />

      <DeleteBranchModal
        open={modals.isDeleteBranchModalOpen}
        branch={modals.branchForModal}
        onClose={modals.closeDeleteBranchModal}
        onSuccess={modals.handleDeleteBranchSuccess}
      />

      {selectedBranch !== null && (
        <CreateSamplingLocationModal
          open={modals.isCreateLocationModalOpen}
          branchId={selectedBranch.id}
          onClose={modals.closeCreateLocationModal}
          onSuccess={modals.handleCreateLocationSuccess}
        />
      )}

      <EditSamplingLocationModal
        open={modals.isEditLocationModalOpen}
        location={modals.selectedLocation}
        onClose={modals.closeEditLocationModal}
        onSuccess={modals.handleEditLocationSuccess}
      />

      <DeleteSamplingLocationModal
        open={modals.isDeleteLocationModalOpen}
        location={modals.selectedLocation}
        onClose={modals.closeDeleteLocationModal}
        onSuccess={modals.handleDeleteLocationSuccess}
      />

      {selectedBranch !== null && (
        <CreateWellModeModal
          open={modals.isCreateWellModeModalOpen}
          branchId={selectedBranch.id}
          onClose={modals.closeCreateWellModeModal}
          onSuccess={modals.handleCreateWellModeSuccess}
        />
      )}

      <EditWellModeModal
        open={modals.isEditWellModeModalOpen}
        wellMode={modals.selectedWellMode}
        onClose={modals.closeEditWellModeModal}
        onSuccess={modals.handleEditWellModeSuccess}
      />

      <DeleteWellModeModal
        open={modals.isDeleteWellModeModalOpen}
        wellMode={modals.selectedWellMode}
        onClose={modals.closeDeleteWellModeModal}
        onSuccess={modals.handleDeleteWellModeSuccess}
      />
    </Layout>
  );
};

export default SamplingLocationsWorkspaceView;
