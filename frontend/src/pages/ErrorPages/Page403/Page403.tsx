import { ErrorCard } from '../../../features/Cards';
import animationAccessDenied from '../../../shared/assets/animations/503_1.json';
import './Page403.css';

const Page403 = () => {
  return (
    <div className="page403-wrapper">
      <ErrorCard
        title="Ошибка 403"
        text="Вам отказано в доступе"
        animation={animationAccessDenied}
      />
    </div>
  );
};

export default Page403;
