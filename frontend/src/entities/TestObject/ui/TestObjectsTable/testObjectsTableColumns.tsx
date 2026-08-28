import { Button } from '@/shared/ui/Button';
import { DeleteOutlined, EditOutlined } from '@/shared/ui/icons';
import type { TestObjectCatalogItem } from '../../api';
import type { ColumnDef } from '@tanstack/react-table';

interface CreateTestObjectsTableColumnsParams {
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  canUpdate: boolean;
  canDelete: boolean;
}

const formatVisibilityScope = (item: TestObjectCatalogItem): string => {
  const scope = item.visibility_scope;
  const hasLabs = (scope.laboratory_ids?.length || 0) > 0;
  const hasDepartments = (scope.department_ids?.length || 0) > 0;

  if (!hasLabs && !hasDepartments) {
    return 'Все лаборатории и подразделения';
  }

  const parts: string[] = [];

  scope.laboratories?.forEach(entry => {
    parts.push(entry.name);
  });

  scope.departments?.forEach(entry => {
    parts.push(entry.name);
  });

  if (parts.length === 0) {
    const labIds = scope.laboratory_ids?.join(', ') || '';
    const deptIds = scope.department_ids?.join(', ') || '';
    if (labIds) {
      parts.push(`Лаборатории: ${labIds}`);
    }
    if (deptIds) {
      parts.push(`Подразделения: ${deptIds}`);
    }
  }

  return parts.join('; ');
};

export function createTestObjectsTableColumns({
  onEdit,
  onDelete,
  canUpdate,
  canDelete,
}: CreateTestObjectsTableColumnsParams): ColumnDef<TestObjectCatalogItem>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Наименование',
      cell: ({ row }) => row.original.name || '-',
      enableSorting: true,
      enableColumnFilter: true,
      size: 280,
    },
    {
      accessorKey: 'tag',
      header: 'Тег',
      cell: ({ row }) => row.original.tag || '-',
      enableSorting: true,
      enableColumnFilter: true,
      size: 220,
    },
    {
      accessorKey: 'protocol_abbreviation',
      header: 'Аббревиатура',
      cell: ({ row }) => row.original.protocol_abbreviation || '-',
      enableSorting: false,
      enableColumnFilter: false,
      size: 140,
    },
    {
      id: 'visibility_scope',
      header: 'Область видимости',
      cell: ({ row }) => formatVisibilityScope(row.original),
      enableSorting: false,
      enableColumnFilter: false,
      size: 360,
    },
    {
      id: 'actions',
      header: 'Действия',
      cell: ({ row }) => (
        <div className="test-objects-table-actions">
          {canUpdate && (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(row.original.id)}
              className="test-objects-table-edit-button"
            >
              Редактировать
            </Button>
          )}
          {canDelete && (
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => onDelete(row.original.id)}
              className="test-objects-table-delete-button"
            >
              Удалить
            </Button>
          )}
        </div>
      ),
      enableSorting: false,
      enableColumnFilter: false,
      size: 220,
      enableResizing: false,
    },
  ];
}
