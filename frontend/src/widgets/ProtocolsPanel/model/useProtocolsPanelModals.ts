import { useState } from 'react';
import type { Protocol } from '@/entities/Protocol';

type ProtocolsListApi = {
  data: Protocol[];
};

/** Состояние и обработчики модалок панели протоколов. */
export const useProtocolsPanelModals = (protocols: ProtocolsListApi) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const findProtocol = (protocolId: number) =>
    protocols.data.find(protocol => protocol.id === protocolId) ?? null;

  const handleEdit = (protocolId: number) => {
    const protocol = findProtocol(protocolId);
    if (protocol) {
      setSelectedProtocol(protocol);
      setIsEditModalOpen(true);
    }
  };

  const handleDelete = (protocolId: number) => {
    const protocol = findProtocol(protocolId);
    if (protocol) {
      setSelectedProtocol(protocol);
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
    setSelectedProtocol(null);
  };

  const handleDeleteModalClose = () => {
    setIsDeleteModalOpen(false);
    setSelectedProtocol(null);
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setSelectedProtocol(null);
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    setSelectedProtocol(null);
  };

  return {
    isCreateModalOpen,
    isEditModalOpen,
    isDeleteModalOpen,
    selectedProtocol,
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
