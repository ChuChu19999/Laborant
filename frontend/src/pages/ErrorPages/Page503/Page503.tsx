import Layout from '../../../shared/ui/Layout/Layout';
import './Page503.css';

const Page503 = () => {
  return (
    <div className="page503-wrapper">
      <Layout title="Ошибка 503">
        <div className="page503-content">
          <h1>Ошибка 503</h1>
          <p>Вам отказано в доступе</p>
        </div>
      </Layout>
    </div>
  );
};

export default Page503;
