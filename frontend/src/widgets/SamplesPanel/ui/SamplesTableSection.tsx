import { SamplesTable } from '@/entities/Sample';
import { Button } from '@/shared/ui/Button';
import { DownloadOutlined, FileTextOutlined, PlusOutlined } from '@/shared/ui/icons';
import { ResetFiltersButton } from '@/shared/ui/ResetFiltersButton';
import type { Sample } from '@/entities/Sample';
import type { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table';

interface SamplesTableSectionProps {
  tableKey: number;
  rowData: Sample[];
  isLoading: boolean;
  pagination: PaginationState;
  totalPages: number;
  totalRecords: number;
  laboratoryId?: number;
  departmentId?: number;
  sorting: SortingState;
  initialColumnFilters: ColumnFiltersState;
  isIlninmLaboratory: boolean;
  isExportPending: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canFillCalculations: boolean;
  onCreate: () => void;
  onGenerateReport: () => void;
  onExportTable: () => void;
  onResetFilters: () => void;
  onPaginationChange: (
    updater: PaginationState | ((old: PaginationState) => PaginationState)
  ) => void;
  onFiltersChange: (columnFilters: ColumnFiltersState) => void;
  onSortingChange: (sortingState: SortingState) => void;
  onEdit: (sampleId: number) => void;
  onDelete: (sampleId: number) => void;
  onFillCalculations: (sampleId: number) => void;
}

const SamplesTableSection = ({
  tableKey,
  rowData,
  isLoading,
  pagination,
  totalPages,
  totalRecords,
  laboratoryId,
  departmentId,
  sorting,
  initialColumnFilters,
  isIlninmLaboratory,
  isExportPending,
  canUpdate,
  canDelete,
  canFillCalculations,
  onCreate,
  onGenerateReport,
  onExportTable,
  onResetFilters,
  onPaginationChange,
  onFiltersChange,
  onSortingChange,
  onEdit,
  onDelete,
  onFillCalculations,
}: SamplesTableSectionProps) => {
  return (
    <div className="samples-page-container">
      <div className="samples-page-header">
        <div className="samples-page-header-left">
          <Button type="primary" onClick={onCreate} icon={<PlusOutlined />}>
            Добавить пробу
          </Button>
          {isIlninmLaboratory && (
            <Button type="default" onClick={onGenerateReport} icon={<FileTextOutlined />}>
              Сформировать отчёт
            </Button>
          )}
          <Button
            type="default"
            onClick={onExportTable}
            icon={<DownloadOutlined />}
            loading={isExportPending}
            disabled={!laboratoryId || isLoading}
          >
            Сохранить таблицу
          </Button>
        </div>
        <div className="samples-page-header-right">
          <ResetFiltersButton onReset={onResetFilters} />
        </div>
      </div>
      <div className="samples-page-table">
        <SamplesTable
          key={tableKey}
          data={rowData}
          loading={isLoading}
          pagination={pagination}
          totalPages={totalPages}
          totalRecords={totalRecords}
          laboratoryId={laboratoryId}
          departmentId={departmentId}
          onPaginationChange={onPaginationChange}
          onFiltersChange={onFiltersChange}
          onSortingChange={onSortingChange}
          sorting={sorting}
          onEdit={onEdit}
          onDelete={onDelete}
          onFillCalculations={onFillCalculations}
          onCreate={onCreate}
          onResetFilters={onResetFilters}
          initialColumnFilters={tableKey === 0 ? initialColumnFilters : []}
          canUpdate={canUpdate}
          canDelete={canDelete}
          canFillCalculations={canFillCalculations}
          canCreate
        />
      </div>
    </div>
  );
};

export default SamplesTableSection;
