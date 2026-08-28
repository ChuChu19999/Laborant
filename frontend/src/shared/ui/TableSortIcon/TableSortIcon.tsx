import { FaSort, FaSortDown, FaSortUp } from 'react-icons/fa';

interface TableSortIconProps {
  sorted: false | 'asc' | 'desc';
  size?: number;
}

const TableSortIcon = ({ sorted, size = 14 }: TableSortIconProps) => {
  if (sorted === 'asc') {
    return <FaSortUp size={size} />;
  }
  if (sorted === 'desc') {
    return <FaSortDown size={size} />;
  }
  return <FaSort size={size} />;
};

export default TableSortIcon;
