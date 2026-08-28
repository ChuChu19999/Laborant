import { useState } from 'react';
import type { Sample } from '@/entities/Sample';

type SamplesListApi = {
  data: Sample[];
};

export const useSamplesPanelModals = (samples: SamplesListApi) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFillCalculationsModalOpen, setIsFillCalculationsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isGenerateReportModalOpen, setIsGenerateReportModalOpen] = useState(false);

  const findSample = (sampleId: number) =>
    samples.data.find(sample => sample.id === sampleId) ?? null;

  const handleCreateModalClose = () => {
    setIsCreateModalOpen(false);
  };

  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false);
  };

  const handleEdit = (sampleId: number) => {
    const sample = findSample(sampleId);
    if (sample) {
      setSelectedSample(sample);
      setIsEditModalOpen(true);
    }
  };

  const handleDelete = (sampleId: number) => {
    const sample = findSample(sampleId);
    if (sample) {
      setSelectedSample(sample);
      setIsDeleteModalOpen(true);
    }
  };

  const handleDeleteConfirm = () => {
    setIsDeleteModalOpen(false);
    setSelectedSample(null);
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setSelectedSample(null);
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    setSelectedSample(null);
  };

  const handleFillCalculationsFromTable = (sampleId: number) => {
    const sample = findSample(sampleId);
    if (sample) {
      setSelectedSample(sample);
      setIsFillCalculationsModalOpen(true);
    }
  };

  const handleFillCalculationsClose = () => {
    setIsFillCalculationsModalOpen(false);
    setSelectedSample(null);
  };

  const handleDeleteModalClose = () => {
    setIsDeleteModalOpen(false);
    setSelectedSample(null);
  };

  const handleGenerateReportModalClose = () => {
    setIsGenerateReportModalOpen(false);
  };

  return {
    isCreateModalOpen,
    isEditModalOpen,
    isFillCalculationsModalOpen,
    isDeleteModalOpen,
    isGenerateReportModalOpen,
    selectedSample,
    openCreateModal: () => setIsCreateModalOpen(true),
    openGenerateReportModal: () => setIsGenerateReportModalOpen(true),
    handleCreateModalClose,
    handleCreateSuccess,
    handleEdit,
    handleDelete,
    handleDeleteConfirm,
    handleEditModalClose,
    handleEditSuccess,
    handleFillCalculationsFromTable,
    handleFillCalculationsClose,
    handleDeleteModalClose,
    handleGenerateReportModalClose,
  };
};
