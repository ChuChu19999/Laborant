import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { branchKeys, type Branch } from '@/entities/Branch';
import { samplingLocationKeys, type SamplingLocation } from '@/entities/SamplingLocation';
import { wellModeKeys, type WellMode } from '@/entities/WellMode';

type UseSamplingLocationsPanelModalsParams = {
  onAfterDeleteBranch: (removedBranchId: number) => void;
};

/** Состояние и обработчики модалок филиалов, мест отбора и режимов. */
export const useSamplingLocationsPanelModals = ({
  onAfterDeleteBranch,
}: UseSamplingLocationsPanelModalsParams) => {
  const queryClient = useQueryClient();

  const [branchForModal, setBranchForModal] = useState<Branch | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<SamplingLocation | null>(null);
  const [selectedWellMode, setSelectedWellMode] = useState<WellMode | null>(null);

  const [isCreateBranchModalOpen, setIsCreateBranchModalOpen] = useState(false);
  const [isEditBranchModalOpen, setIsEditBranchModalOpen] = useState(false);
  const [isDeleteBranchModalOpen, setIsDeleteBranchModalOpen] = useState(false);
  const [isCreateLocationModalOpen, setIsCreateLocationModalOpen] = useState(false);
  const [isEditLocationModalOpen, setIsEditLocationModalOpen] = useState(false);
  const [isDeleteLocationModalOpen, setIsDeleteLocationModalOpen] = useState(false);
  const [isCreateWellModeModalOpen, setIsCreateWellModeModalOpen] = useState(false);
  const [isEditWellModeModalOpen, setIsEditWellModeModalOpen] = useState(false);
  const [isDeleteWellModeModalOpen, setIsDeleteWellModeModalOpen] = useState(false);

  const refetchBranches = () => {
    void queryClient.invalidateQueries({ queryKey: branchKeys.all });
  };

  const refetchLocations = () => {
    void queryClient.invalidateQueries({ queryKey: samplingLocationKeys.all });
  };

  const refetchWellModes = () => {
    void queryClient.invalidateQueries({ queryKey: wellModeKeys.all });
  };

  const openCreateBranchModal = () => {
    setIsCreateBranchModalOpen(true);
  };

  const closeCreateBranchModal = () => {
    setIsCreateBranchModalOpen(false);
  };

  const handleCreateBranchSuccess = () => {
    setIsCreateBranchModalOpen(false);
    refetchBranches();
  };

  const handleEditBranch = (branch: Branch) => {
    setBranchForModal(branch);
    setIsEditBranchModalOpen(true);
  };

  const closeEditBranchModal = () => {
    setIsEditBranchModalOpen(false);
    setBranchForModal(null);
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

  const closeDeleteBranchModal = () => {
    setIsDeleteBranchModalOpen(false);
    setBranchForModal(null);
  };

  const handleDeleteBranchSuccess = () => {
    const removedBranchId = branchForModal?.id;
    setIsDeleteBranchModalOpen(false);
    setBranchForModal(null);
    if (removedBranchId != null) {
      onAfterDeleteBranch(removedBranchId);
    }
    refetchBranches();
    refetchLocations();
  };

  const openCreateLocationModal = () => {
    setIsCreateLocationModalOpen(true);
  };

  const closeCreateLocationModal = () => {
    setIsCreateLocationModalOpen(false);
  };

  const handleCreateLocationSuccess = () => {
    setIsCreateLocationModalOpen(false);
    refetchLocations();
  };

  const handleEditLocation = (location: SamplingLocation) => {
    setSelectedLocation(location);
    setIsEditLocationModalOpen(true);
  };

  const closeEditLocationModal = () => {
    setIsEditLocationModalOpen(false);
    setSelectedLocation(null);
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

  const closeDeleteLocationModal = () => {
    setIsDeleteLocationModalOpen(false);
    setSelectedLocation(null);
  };

  const handleDeleteLocationSuccess = () => {
    setIsDeleteLocationModalOpen(false);
    setSelectedLocation(null);
    refetchLocations();
  };

  const openCreateWellModeModal = () => {
    setIsCreateWellModeModalOpen(true);
  };

  const closeCreateWellModeModal = () => {
    setIsCreateWellModeModalOpen(false);
  };

  const handleCreateWellModeSuccess = () => {
    setIsCreateWellModeModalOpen(false);
    refetchWellModes();
  };

  const handleEditWellMode = (wellMode: WellMode) => {
    setSelectedWellMode(wellMode);
    setIsEditWellModeModalOpen(true);
  };

  const closeEditWellModeModal = () => {
    setIsEditWellModeModalOpen(false);
    setSelectedWellMode(null);
  };

  const handleEditWellModeSuccess = () => {
    setIsEditWellModeModalOpen(false);
    setSelectedWellMode(null);
    refetchWellModes();
  };

  const handleDeleteWellMode = (wellMode: WellMode) => {
    setSelectedWellMode(wellMode);
    setIsDeleteWellModeModalOpen(true);
  };

  const closeDeleteWellModeModal = () => {
    setIsDeleteWellModeModalOpen(false);
    setSelectedWellMode(null);
  };

  const handleDeleteWellModeSuccess = () => {
    setIsDeleteWellModeModalOpen(false);
    setSelectedWellMode(null);
    refetchWellModes();
  };

  return {
    branchForModal,
    selectedLocation,
    selectedWellMode,
    isCreateBranchModalOpen,
    isEditBranchModalOpen,
    isDeleteBranchModalOpen,
    isCreateLocationModalOpen,
    isEditLocationModalOpen,
    isDeleteLocationModalOpen,
    isCreateWellModeModalOpen,
    isEditWellModeModalOpen,
    isDeleteWellModeModalOpen,
    openCreateBranchModal,
    closeCreateBranchModal,
    handleCreateBranchSuccess,
    handleEditBranch,
    closeEditBranchModal,
    handleEditBranchSuccess,
    handleDeleteBranch,
    closeDeleteBranchModal,
    handleDeleteBranchSuccess,
    openCreateLocationModal,
    closeCreateLocationModal,
    handleCreateLocationSuccess,
    handleEditLocation,
    closeEditLocationModal,
    handleEditLocationSuccess,
    handleDeleteLocation,
    closeDeleteLocationModal,
    handleDeleteLocationSuccess,
    openCreateWellModeModal,
    closeCreateWellModeModal,
    handleCreateWellModeSuccess,
    handleEditWellMode,
    closeEditWellModeModal,
    handleEditWellModeSuccess,
    handleDeleteWellMode,
    closeDeleteWellModeModal,
    handleDeleteWellModeSuccess,
  };
};

export type SamplingLocationsPanelModalsApi = ReturnType<typeof useSamplingLocationsPanelModals>;
