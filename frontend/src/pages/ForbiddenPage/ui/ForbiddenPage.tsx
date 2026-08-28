import { loadAccessDeniedAnimation } from '@/shared/assets';
import { ErrorCard } from '@/shared/ui/ErrorCard';
import './ForbiddenPage.css';

const ForbiddenPage = () => {
  return (
    <div className="page403-wrapper">
      <ErrorCard
        title="Ошибка 403"
        text="Вам отказано в доступе"
        loadAnimation={loadAccessDeniedAnimation}
      />
    </div>
  );
};

export default ForbiddenPage;
