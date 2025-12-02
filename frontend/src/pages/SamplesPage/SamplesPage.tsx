import { useState, useMemo } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { CreateSampleModal, EditSampleModal } from '../../features/Modals';
import { sampleApi, type SampleResponse } from '../../shared/api/sample';
import Button from '../../shared/ui/Button/Button';
import Layout from '../../shared/ui/Layout/Layout';
import { DataTable } from '../../widgets/DataTable';
import {
  LaboratoryDepartmentSelector,
  type ViewMode,
} from '../../widgets/LaboratoryDepartmentSelector';
import { NavigationBar } from '../../widgets/NavigationBar';
import type {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  PaginationState,
} from '@tanstack/react-table';
import './SamplesPage.css';

const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

function SamplesPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('laboratories');
  const [selectedLaboratory, setSelectedLaboratory] = useState<{ id: number; name: string } | null>(
    null
  );
  const [selectedDepartment, setSelectedDepartment] = useState<{ id: number; name: string } | null>(
    null
  );
  const [isCreateSampleModalOpen, setIsCreateSampleModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState<SampleResponse | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Запрос проб
  const { data: samplesData, isLoading: isLoadingSamples } = useQuery({
    queryKey: [
      'samples',
      selectedLaboratory?.id,
      selectedDepartment?.id,
      pagination.pageIndex + 1,
      pagination.pageSize,
      sorting,
      columnFilters,
    ],
    queryFn: () =>
      sampleApi.listSamples({
        laboratory_id: selectedLaboratory?.id,
        department_id: selectedDepartment?.id,
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        sort_by: sorting[0]?.id,
        sort_order: sorting[0]?.desc ? 'desc' : 'asc',
        search: columnFilters.find(f => f.id === 'registration_number')?.value as
          | string
          | undefined,
      }),
    enabled: viewMode === 'selected' && selectedLaboratory !== null,
  });

  const handleSelectLaboratory = (laboratory: { id: number; name: string }) => {
    setSelectedLaboratory(laboratory);
  };

  const handleBackToLaboratories = () => {
    setViewMode('laboratories');
    setSelectedLaboratory(null);
    setSelectedDepartment(null);
  };

  const handleSelectDepartment = (department: { id: number; name: string }) => {
    setSelectedDepartment(department);
    setPagination({ pageIndex: 0, pageSize: 20 });
  };

  const handleBackToDepartments = () => {
    setViewMode('departments');
    setSelectedDepartment(null);
  };

  const handleAddSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['samples'] });
    message.success('Проба успешно создана');
    setIsCreateSampleModalOpen(false);
  };

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['samples'] });
    message.success('Проба успешно обновлена');
    setIsEditModalOpen(false);
    setSelectedSample(null);
  };

  const handleRowClick = (sample: SampleResponse) => {
    setSelectedSample(sample);
    setIsEditModalOpen(true);
  };

  const columns = useMemo<ColumnDef<SampleResponse>[]>(
    () => [
      {
        accessorKey: 'registration_number',
        header: '№ пробы',
        cell: ({ row }) => (
          <span
            className="sample-number-link"
            onClick={() => handleRowClick(row.original)}
            style={{ cursor: 'pointer', color: '#1677ff' }}
          >
            {row.original.registration_number || '-'}
          </span>
        ),
        enableSorting: true,
        enableColumnFilter: true,
        size: 150,
      },
      {
        accessorKey: 'test_object',
        header: 'Объект испытания',
        cell: ({ row }) => row.original.test_object || '-',
        enableSorting: true,
        enableColumnFilter: true,
        size: 200,
      },
      {
        accessorKey: 'sampling_location_name',
        header: 'Место отбора',
        cell: ({ row }) => {
          const parts: string[] = [];
          if (row.original.sampling_location_name) {
            parts.push(row.original.sampling_location_name);
          }
          if (row.original.well) {
            parts.push(row.original.well);
          }
          if (row.original.mode) {
            parts.push(row.original.mode);
          }
          return parts.length > 0 ? parts.join(' ') : '-';
        },
        enableSorting: true,
        enableColumnFilter: true,
        size: 200,
      },
      {
        accessorKey: 'sampling_date',
        header: 'Дата отбора',
        cell: ({ row }) => formatDate(row.original.sampling_date),
        enableSorting: true,
        size: 150,
      },
      {
        accessorKey: 'receiving_date',
        header: 'Дата получения пробы',
        cell: ({ row }) => formatDate(row.original.receiving_date),
        enableSorting: true,
        size: 180,
      },
      {
        accessorKey: 'created_at',
        header: 'Дата создания',
        cell: ({ row }) => formatDate(row.original.created_at),
        enableSorting: true,
        size: 150,
      },
    ],
    []
  );

  return (
    <div className="samples-page-wrapper">
      <Layout title="Пробы">
        <div className="samples-page-container">
          {viewMode !== 'selected' && (
            <LaboratoryDepartmentSelector
              pageTitle="Пробы"
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              selectedLaboratory={selectedLaboratory}
              selectedDepartment={selectedDepartment}
              onLaboratorySelect={handleSelectLaboratory}
              onDepartmentSelect={handleSelectDepartment}
              onBackToLaboratories={handleBackToLaboratories}
              onBackToDepartments={handleBackToDepartments}
              requireDepartment={false}
            />
          )}

          {viewMode === 'selected' && selectedLaboratory && (
            <div className="samples-page-content">
              <NavigationBar
                breadcrumbs={[
                  { label: 'Пробы', onClick: handleBackToLaboratories },
                  { label: selectedLaboratory.name, onClick: handleBackToDepartments },
                  ...(selectedDepartment ? [{ label: selectedDepartment.name }] : []),
                ]}
                onBack={handleBackToDepartments}
              />
              <div className="samples-page-header">
                <Button
                  type="primary"
                  onClick={() => setIsCreateSampleModalOpen(true)}
                  icon={<PlusOutlined />}
                >
                  Добавить пробу
                </Button>
              </div>

              <DataTable
                data={samplesData?.items || []}
                columns={columns}
                loading={isLoadingSamples}
                pagination={pagination}
                totalPages={samplesData?.total_pages || 1}
                totalRecords={samplesData?.total || 0}
                onPaginationChange={setPagination}
                onSortingChange={setSorting}
                onFiltersChange={setColumnFilters}
                sorting={sorting}
              />
            </div>
          )}
        </div>
      </Layout>

      <CreateSampleModal
        isOpen={isCreateSampleModalOpen}
        onClose={() => setIsCreateSampleModalOpen(false)}
        onSuccess={handleAddSuccess}
        laboratoryId={selectedLaboratory?.id}
        departmentId={selectedDepartment?.id}
      />

      {selectedSample && (
        <EditSampleModal
          open={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedSample(null);
          }}
          onSuccess={handleEditSuccess}
          sampleId={selectedSample.id}
        />
      )}
    </div>
  );
}

export default SamplesPage;
