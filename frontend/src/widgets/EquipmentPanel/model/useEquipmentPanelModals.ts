import { useState } from 'react';
import type { Equipment } from '@/entities/Equipment';

type EquipmentListApi = {
  data: Equipment[];
};

/** Состояние и обработчики модалок панели приборов. */
export const useEquipmentPanelModals = (equipment: EquipmentListApi) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const findEquipment = (equipmentId: number) =>
    equipment.data.find(item => item.id === equipmentId) ?? null;

  const handleEdit = (equipmentId: number) => {
    const equipmentItem = findEquipment(equipmentId);
    if (equipmentItem) {
      setSelectedEquipment(equipmentItem);
      setIsEditModalOpen(true);
    }
  };

  const handleDelete = (equipmentId: number) => {
    const equipmentItem = findEquipment(equipmentId);
    if (equipmentItem) {
      setSelectedEquipment(equipmentItem);
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
    setSelectedEquipment(null);
  };

  const handleDeleteModalClose = () => {
    setIsDeleteModalOpen(false);
    setSelectedEquipment(null);
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setSelectedEquipment(null);
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    setSelectedEquipment(null);
  };

  return {
    isCreateModalOpen,
    isEditModalOpen,
    isDeleteModalOpen,
    selectedEquipment,
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
