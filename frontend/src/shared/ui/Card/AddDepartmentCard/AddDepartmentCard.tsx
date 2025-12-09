import { PlusOutlined } from '@ant-design/icons';
import './AddDepartmentCard.css';

interface AddDepartmentCardProps {
  onClick?: () => void;
  text?: string;
}

const AddDepartmentCard = ({
  onClick,
  text = 'Добавить подразделение',
}: AddDepartmentCardProps) => {
  return (
    <div className="add-department-card" onClick={onClick}>
      <div className="add-department-card-content">
        <PlusOutlined className="add-department-icon" />
        <h3>{text}</h3>
      </div>
    </div>
  );
};

export default AddDepartmentCard;
