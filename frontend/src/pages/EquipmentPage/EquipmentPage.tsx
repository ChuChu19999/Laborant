import { useState, useMemo } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { message } from 'antd';
import { equipmentApi, type EquipmentResponse } from '../../shared/api/equipment';
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
import './EquipmentPage.css';

const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getEquipmentTypeLabel = (type: string): string => {
  const types: Record<string, string> = {
    measuring_instrument: 'Средство измерения',
    test_equipment: 'Испытательное оборудование',
  };
  return types[type] || type;
};

function EquipmentPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('laboratories');
  const [selectedLaboratory, setSelectedLaboratory] = useState<{ id: number; name: string } | null>(
    null
  );
  const [selectedDepartment, setSelectedDepartment] = useState<{ id: number; name: string } | null>(
    null
  );
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Запрос оборудования
  const { data: equipmentData, isLoading: isLoadingEquipment } = useQuery({
    queryKey: [
      'equipment',
      selectedLaboratory?.id,
      selectedDepartment?.id,
      pagination.pageIndex + 1,
      pagination.pageSize,
      sorting,
      columnFilters,
    ],
    queryFn: () =>
      equipmentApi.listEquipment({
        laboratory_id: selectedLaboratory?.id,
        department_id: selectedDepartment?.id,
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        sort_by: sorting[0]?.id,
        sort_order: sorting[0]?.desc ? 'desc' : 'asc',
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

  const columns = useMemo<ColumnDef<EquipmentResponse>[]>(
    () => [
      {
        accessorKey: 'type',
        header: 'Тип',
        cell: ({ row }) => getEquipmentTypeLabel(row.original.type),
        enableSorting: true,
        enableColumnFilter: true,
        size: 200,
      },
      {
        accessorKey: 'name',
        header: 'Наименование',
        cell: ({ row }) => row.original.name || '-',
        enableSorting: true,
        enableColumnFilter: true,
        size: 250,
      },
      {
        accessorKey: 'serial_number',
        header: 'Заводской номер',
        cell: ({ row }) => row.original.serial_number || '-',
        enableSorting: true,
        enableColumnFilter: true,
        size: 180,
      },
      {
        accessorKey: 'verification_date',
        header: 'Дата поверки',
        cell: ({ row }) => formatDate(row.original.verification_date),
        enableSorting: true,
        size: 150,
      },
      {
        accessorKey: 'verification_end_date',
        header: 'Дата окончания поверки',
        cell: ({ row }) => formatDate(row.original.verification_end_date),
        enableSorting: true,
        size: 200,
      },
      {
        accessorKey: 'version',
        header: 'Версия',
        cell: ({ row }) => row.original.version || '-',
        enableSorting: true,
        size: 120,
      },
    ],
    []
  );

  return (
    <div className="equipment-page-wrapper">
      <Layout title="Оборудование">
        <div className="equipment-page-container">
          {viewMode !== 'selected' && (
            <LaboratoryDepartmentSelector
              pageTitle="Оборудование"
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
            <div className="equipment-page-content">
              <NavigationBar
                breadcrumbs={[
                  { label: 'Оборудование', onClick: handleBackToLaboratories },
                  { label: selectedLaboratory.name, onClick: handleBackToDepartments },
                  ...(selectedDepartment ? [{ label: selectedDepartment.name }] : []),
                ]}
                onBack={handleBackToDepartments}
              />
              <div className="equipment-page-header">
                <Button
                  type="primary"
                  onClick={() => message.info('Создание оборудования будет добавлено')}
                  icon={<PlusOutlined />}
                >
                  Добавить оборудование
                </Button>
              </div>

              <DataTable
                data={equipmentData?.items || []}
                columns={columns}
                loading={isLoadingEquipment}
                pagination={pagination}
                totalPages={equipmentData?.total_pages || 1}
                totalRecords={equipmentData?.total || 0}
                onPaginationChange={setPagination}
                onSortingChange={setSorting}
                onFiltersChange={setColumnFilters}
                sorting={sorting}
              />
            </div>
          )}
        </div>
      </Layout>
    </div>
  );
}

export default EquipmentPage;
