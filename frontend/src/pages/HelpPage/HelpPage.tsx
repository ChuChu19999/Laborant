import Layout from '../../shared/ui/Layout/Layout';
import './HelpPage.css';

const HelpPage = () => {
  return (
    <Layout title="Помощь">
      <div className="help-page-wrapper">
        <div className="help-page-content">
          <p className="title">Новости обновлений:</p>
          <div>
            <p className="version-title">Версия 1.0.1:</p>
            <ul className="list">
              <li className="list-item">Добавлено формирование отчётов</li>
              <li className="list-item">
                Добавлена вкладка "Объекты испытаний" - теперь можно создавать и редактировать
                объекты испытаний
              </li>
            </ul>
            <p className="version-title">Версия 1.0.0:</p>
            <ul className="list">
              <li className="list-item">
                На страницу подразделения "26 съезда КПСС" добавлены новые методы исследований:
                фракционный состав и массовая доля нефти
              </li>
              <li className="list-item">
                Добавлена вкладка "Пробы" - теперь добавление расчетов производится через эту
                вкладку, а не через "Протоколы"
              </li>
              <li className="list-item">Добавлен справочник мест отбора проб</li>
              <li className="list-item">Добавлена вкладка "Приборы"</li>
              <li className="list-item">
                Добавлена обработка условий аккредитации при формировании/создании/редактировании
                протоколов
              </li>
              <li className="list-item">
                Добавлены "Условия отбора" при создании и редактировании проб
              </li>
              <li className="list-item">
                На страницу подразделения "26 съезда КПСС" добавлены новые методы исследований:
                плотность при 20 ℃ и массовая доля воды
              </li>
            </ul>
          </div>
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
