import { PlusOutlined } from '@/shared/ui/icons';
import './AddLaboratoryCard.css';

interface AddLaboratoryCardProps {
  onClick?: () => void;
}

const AddLaboratoryCard = ({ onClick }: AddLaboratoryCardProps) => {
  return (
    <button type="button" className="add-laboratory-card" onClick={onClick}>
      <div className="add-laboratory-card-content">
        <PlusOutlined className="add-laboratory-icon" />
        <h3>Добавить лабораторию</h3>
      </div>
    </button>
  );
};

export default AddLaboratoryCard;
