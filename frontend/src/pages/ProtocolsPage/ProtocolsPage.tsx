import { useState, useMemo } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { message } from 'antd';
import { protocolApi, type ProtocolResponse } from '../../shared/api/protocol';
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
import './ProtocolsPage.css';

const formatDate = (dateString?: string, isAccredited?: boolean): string => {
  if (!dateString || !isAccredited) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getObjectSuffix = (samples?: Array<{ test_object?: string }>): string => {
  if (!samples || !samples.length) return '';
  const firstSample = samples.find(sample => sample.test_object);
  if (!firstSample || !firstSample.test_object) return '';
  const testObjectLower = firstSample.test_object.toLowerCase();
  if (testObjectLower.includes('дегазированный конденсат')) return 'дк';
  if (testObjectLower.includes('нефть') || testObjectLower.includes('нефть калибровочная'))
    return 'н';
  if (testObjectLower.includes('нефтеконденсатная смесь')) return 'нкс';
  if (testObjectLower.includes('дизельное топливо')) return 'дт';
  if (testObjectLower.includes('отработанные нефтепродукты')) return 'он';
  if (testObjectLower.includes('масло турбинное')) return 'м';
  if (testObjectLower.includes('масло авиационное')) return 'м';
  if (testObjectLower.includes('смесь жидких углеводородов')) return 'с';
  if (testObjectLower.includes('ингибитор коррозии')) return 'ик';
  return '';
};

const formatProtocolNumber = (
  number?: string,
  date?: string,
  isAccredited?: boolean,
  samples?: Array<{ test_object?: string }>
): string => {
  if (!number && !date) return '-';
  if (!isAccredited) return number || '-';
  const suffix = getObjectSuffix(samples);
  const formattedDate = formatDate(date, isAccredited);
  if (!number) return `от ${formattedDate}`;
  if (!date) return number;
  const protocolNumber = suffix ? `${number}/07/${suffix}` : `${number}/07`;
  return `${protocolNumber} от ${formattedDate}`;
};

function ProtocolsPage() {
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

  // Запрос протоколов
  const { data: protocolsData, isLoading: isLoadingProtocols } = useQuery({
    queryKey: [
      'protocols',
      selectedLaboratory?.id,
      selectedDepartment?.id,
      pagination.pageIndex + 1,
      pagination.pageSize,
      sorting,
      columnFilters,
    ],
    queryFn: () =>
      protocolApi.listProtocols({
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

  const columns = useMemo<ColumnDef<ProtocolResponse>[]>(
    () => [
      {
        accessorKey: 'test_protocol_number',
        header: '№ протокола',
        cell: ({ row }) =>
          formatProtocolNumber(
            row.original.test_protocol_number,
            row.original.test_protocol_date,
            row.original.is_accredited,
            row.original.samples_data as Array<{ test_object?: string }> | undefined
          ),
        enableSorting: true,
        enableColumnFilter: true,
        size: 200,
      },
      {
        accessorKey: 'sampling_act_number',
        header: 'Номер акта отбора',
        cell: ({ row }) => row.original.sampling_act_number || '-',
        enableSorting: true,
        enableColumnFilter: true,
        size: 180,
      },
      {
        accessorKey: 'samples_data',
        header: 'Пробы',
        cell: ({ row }) => {
          const samples = row.original.samples_data;
          if (!samples || !Array.isArray(samples) || samples.length === 0) {
            return '-';
          }
          return samples
            .map(
              (s: { registration_number?: string } | string) =>
                (typeof s === 'object' && s?.registration_number) || s || ''
            )
            .join(', ');
        },
        enableSorting: true,
        enableColumnFilter: true,
        size: 250,
      },
      {
        accessorKey: 'is_accredited',
        header: 'Аккредитован',
        cell: ({ row }) => (row.original.is_accredited ? '✓' : '-'),
        enableSorting: true,
        size: 120,
      },
      {
        accessorKey: 'created_at',
        header: 'Дата создания',
        cell: ({ row }) => formatDate(row.original.created_at, true),
        enableSorting: true,
        size: 150,
      },
    ],
    []
  );

  return (
    <div className="protocols-page-wrapper">
      <Layout title="Протоколы">
        <div className="protocols-page-container">
          {viewMode !== 'selected' && (
            <LaboratoryDepartmentSelector
              pageTitle="Протоколы"
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
            <div className="protocols-page-content">
              <NavigationBar
                breadcrumbs={[
                  { label: 'Протоколы', onClick: handleBackToLaboratories },
                  { label: selectedLaboratory.name, onClick: handleBackToDepartments },
                  ...(selectedDepartment ? [{ label: selectedDepartment.name }] : []),
                ]}
                onBack={handleBackToDepartments}
              />
              <div className="protocols-page-header">
                <Button
                  type="primary"
                  onClick={() => message.info('Создание протокола будет добавлено')}
                  icon={<PlusOutlined />}
                >
                  Добавить протокол
                </Button>
              </div>

              <DataTable
                data={protocolsData?.items || []}
                columns={columns}
                loading={isLoadingProtocols}
                pagination={pagination}
                totalPages={protocolsData?.total_pages || 1}
                totalRecords={protocolsData?.total || 0}
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

export default ProtocolsPage;
