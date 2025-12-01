import Layout from '../../shared/ui/Layout/Layout';
import './HelpPage.css';

const HelpPage = () => {
  return (
    <Layout title="Помощь">
      <div className="help-page-wrapper">
        <div className="help-page-content">
          <p className="title">Новости обновлений:</p>
          <ul className="list">
            <li className="list-item">Приложение инициализировано</li>
          </ul>
        </div>
        <div>
          <p className="title">Если у Вас возникли вопросы по работе в системе:</p>
          <ul className="list">
            <li className="list-item">позвоните по номеру телефона 9-66-99</li>
            <li className="list-item">
              оставьте обращение в <a>системе поддержки пользователей</a>
            </li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default HelpPage;
