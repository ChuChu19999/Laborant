import type { ReactNode } from 'react';
import './TableEmptyState.css';

interface TableEmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

const TableEmptyState = ({ title, description, action }: TableEmptyStateProps) => (
  <div className="table-empty-state">
    <p className="table-empty-state-title">{title}</p>
    <p className="table-empty-state-description">{description}</p>
    {action ? <div className="table-empty-state-action">{action}</div> : null}
  </div>
);

export default TableEmptyState;
