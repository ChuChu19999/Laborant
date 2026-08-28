import { useState } from 'react';
import type { NdNorm } from '@/entities/NdNorm';

type NdNormsListApi = {
  data: NdNorm[];
};

/** Состояние и обработчики модалок панели норм НД. */
export const useNdNormsPanelModals = (ndNorms: NdNormsListApi) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedNdNorm, setSelectedNdNorm] = useState<NdNorm | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const findNdNorm = (ndNormId: number) => ndNorms.data.find(item => item.id === ndNormId) ?? null;

  const handleEdit = (ndNormId: number) => {
    const ndNormItem = findNdNorm(ndNormId);
    if (ndNormItem) {
      setSelectedNdNorm(ndNormItem);
      setIsEditModalOpen(true);
    }
  };

  const handleDelete = (ndNormId: number) => {
    const ndNormItem = findNdNorm(ndNormId);
    if (ndNormItem) {
      setSelectedNdNorm(ndNormItem);
      setIsDeleteModalOpen(true);
    }
  };

  const handleCreateModalClose = () => {
    setIsCreateModalOpen(false);
  };

  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false);
  };

  const handleDeleteConfirm = () => {
    setIsDeleteModalOpen(false);
    setSelectedNdNorm(null);
  };

  const handleDeleteModalClose = () => {
    setIsDeleteModalOpen(false);
    setSelectedNdNorm(null);
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setSelectedNdNorm(null);
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    setSelectedNdNorm(null);
  };

  return {
    isCreateModalOpen,
    isEditModalOpen,
    isDeleteModalOpen,
    selectedNdNorm,
    openCreateModal: () => setIsCreateModalOpen(true),
    handleCreateModalClose,
    handleCreateSuccess,
    handleEdit,
    handleDelete,
    handleDeleteConfirm,
    handleDeleteModalClose,
    handleEditModalClose,
    handleEditSuccess,
  };
};
