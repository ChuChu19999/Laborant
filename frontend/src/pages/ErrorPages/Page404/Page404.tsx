import Layout from '../../../shared/ui/Layout/Layout';
import './Page404.css';

const Page404 = () => {
  return (
    <div className="page404-wrapper">
      <Layout title="Ошибка 404">
        <div className="page404-content">
          <h1>Ошибка 404</h1>
          <p>
            Кажется вы зашли не на ту страницу. Вернитесь к главной странице и повторите попытку.
          </p>
        </div>
      </Layout>
    </div>
  );
};

export default Page404;
