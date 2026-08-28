import { useState } from 'react';
import type { RoleCatalogItem } from '@/entities/Role';

type RolesListApi = {
  data: RoleCatalogItem[];
};

/** Состояние и обработчики модалок панели ролей. */
export const useRolesPanelModals = (roles: RolesListApi) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RoleCatalogItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const findItem = (id: number) => roles.data.find(entry => entry.id === id) || null;

  const handleEdit = (id: number) => {
    setSelectedItem(findItem(id));
    setIsEditModalOpen(true);
  };

  const handleDelete = (id: number) => {
    setSelectedItem(findItem(id));
    setIsDeleteModalOpen(true);
  };

  const handleModalSuccess = () => {
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    setIsDeleteModalOpen(false);
    setSelectedItem(null);
  };

  return {
    isCreateModalOpen,
    isEditModalOpen,
    isDeleteModalOpen,
    selectedItem,
    openCreateModal: () => setIsCreateModalOpen(true),
    closeCreateModal: () => setIsCreateModalOpen(false),
    closeEditModal: () => {
      setIsEditModalOpen(false);
      setSelectedItem(null);
    },
    closeDeleteModal: () => {
      setIsDeleteModalOpen(false);
      setSelectedItem(null);
    },
    handleEdit,
    handleDelete,
    handleModalSuccess,
  };
};
