import { useOutletContext } from 'react-router-dom';
import Layout from '../../shared/ui/Layout';
import type { UserPermissions } from '../../shared/api/userRole';
import './HelpPage.css';

interface HelpPageContext {
  isAdmin?: boolean;
  permissionsData?: UserPermissions;
}

const HelpPage = () => {
  const { isAdmin, permissionsData } = (useOutletContext() as HelpPageContext) || {};
  const showAdminGuide = Boolean(isAdmin || permissionsData?.is_admin);

  return (
    <Layout title="Помощь">
      <div className="help-page-wrapper">
        <div className="help-page-content">
          {showAdminGuide ? (
            <section className="help-guide-section">
              <p className="title">Администратор: что настроить заранее</p>
              <p className="help-guide-lead">
                Сначала добавьте лаборатории и подразделения. Перед началом работы сотрудников
                настройте методы исследования, объекты испытаний, справочники и роли.
              </p>
              <ol className="help-guide-steps">
                <li className="help-guide-step">
                  <span className="help-guide-step-title">Лаборатории и подразделения</span>
                  <span className="help-guide-step-text">
                    В «Управление лабораториями» создайте структуру лабораторий и подразделений.
                  </span>
                </li>
                <li className="help-guide-step">
                  <span className="help-guide-step-title">Методы исследования</span>
                  <span className="help-guide-step-text">
                    В выбранной лаборатории или подразделении добавьте методы исследования с
                    формулами расчёта.
                  </span>
                </li>
                <li className="help-guide-step">
                  <span className="help-guide-step-title">Объекты испытаний</span>
                  <span className="help-guide-step-text">
                    В «Объекты испытаний» задайте перечень объектов и область видимости для
                    лабораторий и подразделений.
                  </span>
                </li>
                <li className="help-guide-step">
                  <span className="help-guide-step-title">Справочники</span>
                  <span className="help-guide-step-text">
                    При необходимости заполните приборы, места отбора проб, нормы НД и
                    градуировочный график.
                  </span>
                </li>
                <li className="help-guide-step">
                  <span className="help-guide-step-title">Роли и права</span>
                  <span className="help-guide-step-text">
                    В «Роли» создайте роли лаборанта или инженера. На странице прав роли добавьте
                    привязки к лабораториям и подразделениям и для каждой привязки задайте вкладки и
                    права, затем выдайте доступ сотрудникам.
                  </span>
                </li>
              </ol>
            </section>
          ) : null}

          <section className="help-guide-section">
            <p className="title">Основной сценарий работы</p>
            <ol className="help-guide-steps">
              <li className="help-guide-step">
                <span className="help-guide-step-title">1. Проба</span>
                <span className="help-guide-step-text">
                  Откройте «Поступления проб», выберите лабораторию и подразделение, зарегистрируйте
                  пробу.
                </span>
              </li>
              <li className="help-guide-step">
                <span className="help-guide-step-title">2. Расчёт</span>
                <span className="help-guide-step-text">
                  В строке пробы откройте расчёты, нажмите «Добавить расчёт», выберите методы
                  исследования, рассчитайте и сохраните результаты.
                </span>
              </li>
              <li className="help-guide-step">
                <span className="help-guide-step-title">3. Протокол</span>
                <span className="help-guide-step-text">
                  В «Протоколы» оформите протокол по пробам с расчётами и при необходимости
                  сформируйте файл.
                </span>
              </li>
            </ol>
          </section>

          <section className="help-guide-section">
            <p className="title">Новости обновлений</p>
            <div>
              <p className="version-title">Версия 1.0.3:</p>
              <ul className="list">
                <li className="list-item">Добавлена настройка прав доступа для ролей</li>
                <li className="list-item">
                  В боковом меню появились группы «Справочники» и «Администрирование»
                </li>
                <li className="list-item">
                  «Управление лабораториями» вынесено на отдельную страницу в разделе
                  администрирования
                </li>
                <li className="list-item">
                  «Градуировочный график» перенесён из администрирования методов во вкладку
                  справочников
                </li>
                <li className="list-item">
                  Шаблоны протоколов, шаблоны отчётов и условия отбора перенесены из
                  администрирования методов в карточки лабораторий и подразделений в «Управление
                  лабораториями»
                </li>
              </ul>
              <p className="version-title">Версия 1.0.2:</p>
              <ul className="list">
                <li className="list-item">
                  Добавлена вкладка «Нормы НД» — справочник текстов норм по методам исследования для
                  выбранного объекта испытаний
                </li>
                <li className="list-item">
                  Добавлена вкладка «Роли» — создание и редактирование ролей лаборанта и инженера
                </li>
                <li className="list-item">
                  При создании и редактировании пробы указывается количество показателей
                </li>
                <li className="list-item">
                  Добавлено редактирование сохранённых расчётов: при сохранении создаётся новая
                  запись, предыдущая остаётся в истории
                </li>
                <li className="list-item">
                  При редактировании расчёта, если методика в справочнике изменилась, система
                  предложит выбрать расчёт по старым или по новым правилам
                </li>
              </ul>
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
          </section>
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
