import { useState } from 'react';
import type { SampleType } from '@/entities/SampleType';

/** Состояние и обработчики модалок панели типов проб. */
export const useSampleTypesPanelModals = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SampleType | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleEdit = (item: SampleType) => {
    setSelectedItem(item);
    setIsEditModalOpen(true);
  };

  const handleDelete = (item: SampleType) => {
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
