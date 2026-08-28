import { Button } from '@/shared/ui/Button';
import { DeleteOutlined, EditOutlined, SettingOutlined } from '@/shared/ui/icons';
import { formatRoleScopeLabel } from '../../lib/roleScopeOptions';
import { formatRoleType } from '../../lib/roleTypeOptions';
import type { RoleCatalogItem } from '../../api';
import type { ColumnDef } from '@tanstack/react-table';

interface CreateRolesTableColumnsParams {
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onConfigure: (id: number) => void;
}

const formatVisibilityScope = (item: RoleCatalogItem): string => {
  const scopes = item.scopes || [];
  if (scopes.length === 0) {
    return 'Нет доступа';
  }
  return scopes.map(formatRoleScopeLabel).join('; ');
};

export function createRolesTableColumns({
  onEdit,
  onDelete,
  onConfigure,
}: CreateRolesTableColumnsParams): ColumnDef<RoleCatalogItem>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Роль',
      cell: ({ row }) => row.original.name || '-',
      enableSorting: true,
      enableColumnFilter: true,
      size: 260,
    },
    {
      accessorKey: 'role_type',
      header: 'Тип роли',
      cell: ({ row }) => formatRoleType(row.original.role_type),
      enableSorting: true,
      enableColumnFilter: true,
      size: 180,
    },
    {
      id: 'visibility_scope',
      header: 'Лаборатории / подразделения',
      cell: ({ row }) => formatVisibilityScope(row.original),
      enableSorting: false,
      enableColumnFilter: false,
      size: 360,
    },
    {
      id: 'actions',
      header: 'Действия',
      cell: ({ row }) => (
        <div className="roles-table-actions">
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => onConfigure(row.original.id)}
            className="roles-table-configure-button"
          >
            Настроить
          </Button>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(row.original.id)}
            className="roles-table-edit-button"
          >
            Редактировать
          </Button>
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => onDelete(row.original.id)}
            className="roles-table-delete-button"
          >
            Удалить
          </Button>
        </div>
      ),
      enableSorting: false,
      enableColumnFilter: false,
      size: 320,
      enableResizing: false,
    },
  ];
}
