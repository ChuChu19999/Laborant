import { PlusOutlined } from '@ant-design/icons';
import './AddLaboratoryCard.css';

interface AddLaboratoryCardProps {
  onClick?: () => void;
}

const AddLaboratoryCard = ({ onClick }: AddLaboratoryCardProps) => {
  return (
    <div className="add-laboratory-card" onClick={onClick}>
      <div className="add-laboratory-card-content">
        <PlusOutlined className="add-laboratory-icon" />
        <h3>Добавить лабораторию</h3>
      </div>
    </div>
  );
};

export default AddLaboratoryCard;
