import { ConfigProvider } from 'antd';
import { BiChevronLeft, BiChevronRight, BiChevronsLeft, BiChevronsRight } from 'react-icons/bi';
import { Select } from '@/shared/ui/FormItems';
import { TABLE_CONTROL_THEME } from '@/shared/ui/TableFilter/tableControlTheme';
import './TablePagination.css';

interface TablePaginationProps {
  shownCount: number;
  totalRecords: number;
  pageIndex: number;
  pageCount: number;
  pageSize: number;
  pageSizeOptions?: number[];
  canPreviousPage: boolean;
  canNextPage: boolean;
  onFirstPage: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onLastPage: () => void;
  onPageSizeChange: (pageSize: number) => void;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

const TablePagination = ({
  shownCount,
  totalRecords,
  pageIndex,
  pageCount,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  canPreviousPage,
  canNextPage,
  onFirstPage,
  onPreviousPage,
  onNextPage,
  onLastPage,
  onPageSizeChange,
}: TablePaginationProps) => {
  return (
    <div className="table-pagination">
      <div className="table-pagination-info">
        Показано {shownCount} из {totalRecords} записей
      </div>
      <div className="table-pagination-controls">
        <button
          type="button"
          className="table-pagination-icon"
          onClick={onFirstPage}
          disabled={!canPreviousPage}
        >
          <BiChevronsLeft size={20} />
        </button>
        <button
          type="button"
          className="table-pagination-icon"
          onClick={onPreviousPage}
          disabled={!canPreviousPage}
        >
          <BiChevronLeft size={20} />
        </button>
        <span className="table-pagination-page-info">
          Страница {pageIndex + 1} из {pageCount}
        </span>
        <button
          type="button"
          className="table-pagination-icon"
          onClick={onNextPage}
          disabled={!canNextPage}
        >
          <BiChevronRight size={20} />
        </button>
        <button
          type="button"
          className="table-pagination-icon"
          onClick={onLastPage}
          disabled={!canNextPage}
        >
          <BiChevronsRight size={20} />
        </button>
        <ConfigProvider theme={TABLE_CONTROL_THEME}>
          <Select
            value={pageSize}
            onChange={(value: unknown) => {
              onPageSizeChange(value as number);
            }}
            className="table-pagination-page-size-select"
            style={{ width: 100 }}
            options={pageSizeOptions.map(size => ({
              label: `${size} строк`,
              value: size,
            }))}
          />
        </ConfigProvider>
      </div>
    </div>
  );
};

export default TablePagination;
export type { TablePaginationProps };
