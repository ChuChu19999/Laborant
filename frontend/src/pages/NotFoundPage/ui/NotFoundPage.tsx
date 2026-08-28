import { Layout } from '@/shared/ui/Layout';
import './NotFoundPage.css';

const NotFoundPage = () => {
  return (
    <div className="page404-wrapper">
      <Layout title="Ошибка 404">
        <div className="page404-content">
          <h1>Ошибка 404</h1>
          <p>
            Кажется, вы зашли не на ту страницу. Вернитесь к главной странице и повторите попытку.
          </p>
        </div>
      </Layout>
    </div>
  );
};

export default NotFoundPage;
