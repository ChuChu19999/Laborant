import { useState } from 'react';
import type { TestPurpose } from '@/entities/TestPurpose';

/** Состояние и обработчики модалок панели целей испытаний. */
export const useTestPurposesPanelModals = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TestPurpose | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleEdit = (item: TestPurpose) => {
    setSelectedItem(item);
    setIsEditModalOpen(true);
  };

  const handleDelete = (item: TestPurpose) => {
    setSelectedItem(item);
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
