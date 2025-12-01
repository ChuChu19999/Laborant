import { PlusOutlined } from '@ant-design/icons';
import './AddDepartmentCard.css';

interface AddDepartmentCardProps {
  onClick?: () => void;
}

const AddDepartmentCard = ({ onClick }: AddDepartmentCardProps) => {
  return (
    <div className="add-department-card" onClick={onClick}>
      <div className="add-department-card-content">
        <PlusOutlined className="add-department-icon" />
        <h3>Добавить подразделение</h3>
      </div>
    </div>
  );
};

export default AddDepartmentCard;
