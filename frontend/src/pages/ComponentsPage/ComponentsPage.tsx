import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form } from 'antd';
import { ConfirmationModal } from '../../entities/ConfirmationModal';
import { UserPicker, type Employee } from '../../entities/UserPicker';
import { ErrorCard, LoadingCard } from '../../features/Cards';
import ElementsList from '../../features/FormItems/ui/ElementsList/ElementsList';
import FormItem from '../../features/FormItems/ui/FormItem/FormItem';
import errorAnimation404 from '../../shared/assets/animations/404_1.json';
import errorAnimation503 from '../../shared/assets/animations/503_1.json';
import Bubble from '../../shared/ui/Bubble/Bubble';
import Button from '../../shared/ui/Button/Button';
import {
  LaboratoryCard,
  DepartmentCard,
  AddLaboratoryCard,
  AddDepartmentCard,
} from '../../shared/ui/Card';
import { FormWrapper, InputText, RadioGroup, Select } from '../../shared/ui/FormItems';
import Layout from '../../shared/ui/Layout/Layout';
import { Modal } from '../../shared/ui/Modal';
import Tooltip from '../../shared/ui/Tooltip/Tooltip';
import Tour from '../../shared/ui/Tour/Tour';
import { NavigationBar } from '../../widgets/NavigationBar';
import { UserInfo } from '../../widgets/UserInfo';
import './ComponentsPage.css';

const ComponentsPage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingCardLoading, setLoadingCardLoading] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const tourButtonRef = useRef<HTMLDivElement>(null);
  const tourCardRef = useRef<HTMLDivElement>(null);

  return (
    <Layout title="Путеводитель по компонентам">
      <LoadingCard loading={loadingCardLoading} />
      <div className="components-page-content">
        {/* Shared UI Components */}
        <section className="components-section">
          <h3 className="section-title">Shared UI Components</h3>
          <div className="components-grid">
            <div className="component-card">
              <h4>Button</h4>
              <Button title="Пример кнопки" type="primary" />
            </div>

            <div className="component-card">
              <h4>Bubble</h4>
              <Bubble text="Пример Bubble" />
            </div>

            <div className="component-card">
              <h4>Tooltip</h4>
              <Tooltip {...{ title: 'Пример подсказки' }}>
                <span style={{ color: '#000' }}>Наведите на меня</span>
              </Tooltip>
            </div>

            <div className="component-card" ref={tourCardRef}>
              <h4>Tour</h4>
              <div ref={tourButtonRef}>
                <Button title="Запустить тур" onClick={() => setTourOpen(true)} />
              </div>
              <Tour
                open={tourOpen}
                onClose={() => setTourOpen(false)}
                steps={[
                  {
                    title: 'Добро пожаловать!',
                    description:
                      'Это пример использования компонента Tour. Он помогает создавать интерактивные туры по интерфейсу.',
                    target: () => tourButtonRef.current || document.body,
                  },
                  {
                    title: 'Компоненты',
                    description:
                      'На этой странице представлены все компоненты из директорий shared, features и widgets.',
                    target: () => tourCardRef.current || document.body,
                  },
                ]}
              />
            </div>
          </div>
        </section>

        {/* Shared Cards */}
        <section className="components-section">
          <h3 className="section-title">Shared Cards</h3>
          <div className="components-grid">
            <div className="component-card">
              <h4>LaboratoryCard</h4>
              <LaboratoryCard
                laboratory={{
                  name: 'Пример лаборатории',
                  description: 'Описание лаборатории',
                  full_name: 'Полное название лаборатории',
                  laboratory_location: 'Москва, ул. Примерная, д. 1',
                }}
                onClick={() => console.log('Clicked')}
              />
            </div>

            <div className="component-card">
              <h4>DepartmentCard</h4>
              <DepartmentCard
                department={{
                  name: 'Пример отдела',
                  laboratory_location: 'Москва, ул. Примерная, д. 1',
                }}
                iconIndex={0}
                onClick={() => console.log('Clicked')}
              />
            </div>

            <div className="component-card">
              <h4>AddLaboratoryCard</h4>
              <AddLaboratoryCard onClick={() => console.log('Add laboratory')} />
            </div>

            <div className="component-card">
              <h4>AddDepartmentCard</h4>
              <AddDepartmentCard onClick={() => console.log('Add department')} />
            </div>
          </div>
        </section>

        {/* Shared Form Items */}
        <section className="components-section">
          <h3 className="section-title">Shared Form Items</h3>
          <div className="components-grid">
            <div className="component-card">
              <h4>FormWrapper</h4>
              <p style={{ marginBottom: '12px', fontSize: '14px', color: '#666' }}>
                Обертка для элементов формы, обеспечивающая единообразное оформление
              </p>
              <FormWrapper>
                <InputText placeholder="Введите текст" rows={2} />
              </FormWrapper>
            </div>

            <div className="component-card">
              <h4>InputText</h4>
              <InputText placeholder="Текстовое поле (TextArea)" rows={2} />
            </div>

            <div className="component-card">
              <h4>RadioGroup</h4>
              <Form form={form}>
                <RadioGroup
                  data={[
                    { name: 'Вариант 1', value: '1' },
                    { name: 'Вариант 2', value: '2' },
                    { name: 'Вариант 3', value: '3' },
                  ]}
                  name="example"
                />
              </Form>
            </div>

            <div className="component-card">
              <h4>Select</h4>
              <Select
                options={[
                  { label: 'Опция 1', value: '1' },
                  { label: 'Опция 2', value: '2' },
                ]}
                placeholder="Выберите опцию"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </section>

        {/* Shared Modal */}
        <section className="components-section">
          <h3 className="section-title">Shared Modal</h3>
          <div className="components-grid">
            <div className="component-card">
              <h4>Modal</h4>
              <Button title="Открыть модальное окно" onClick={() => setModalOpen(true)} />
              {modalOpen && (
                <>
                  <div
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      zIndex: 999,
                      margin: 0,
                    }}
                  />
                  <Modal
                    header="Пример модального окна"
                    onClose={() => setModalOpen(false)}
                    onSave={() => {
                      console.log('Saved');
                      setModalOpen(false);
                    }}
                    saveButtonText="Сохранить"
                  >
                    <p>Это пример модального окна. Здесь может быть любой контент.</p>
                  </Modal>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Entities Components */}
        <section className="components-section">
          <h3 className="section-title">Entities Components</h3>
          <div className="components-grid">
            <div className="component-card">
              <h4>ConfirmationModal</h4>
              <p style={{ marginBottom: '12px', fontSize: '14px', color: '#666' }}>
                Базовая модалка подтверждения, использующая базовую модалку из shared/ui/Modal.
                Предназначена для запроса подтверждения действий пользователя.
              </p>
              <Button
                title="Открыть модалку подтверждения"
                onClick={() => setConfirmationModalOpen(true)}
              />
              <ConfirmationModal
                open={confirmationModalOpen}
                title="Подтверждение действия"
                message="Вы уверены, что хотите выполнить это действие?"
                confirmText="Подтвердить"
                cancelText="Отмена"
                onConfirm={() => {
                  console.log('Действие подтверждено');
                  setConfirmationModalOpen(false);
                }}
                onCancel={() => setConfirmationModalOpen(false)}
                style={{ width: '400px', maxWidth: '90vw' }}
              />
            </div>
            <div className="component-card">
              <h4>UserPicker</h4>
              <p style={{ marginBottom: '12px', fontSize: '14px', color: '#666' }}>
                Поле выбора сотрудника с поиском по ФИО (минимум 3 символа).
              </p>
              <div style={{ maxWidth: 360 }}>
                <UserPicker
                  value={selectedEmployee}
                  onChange={setSelectedEmployee}
                  placeholder="Введите ФИО сотрудника"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features Components */}
        <section className="components-section">
          <h3 className="section-title">Features Components</h3>
          <div className="components-grid">
            <div className="component-card" style={{ gridColumn: '1 / -1' }}>
              <h4>ErrorCard (404)</h4>
              <ErrorCard
                title="Ошибка"
                text="Пример отображения ошибки 404"
                animation={errorAnimation404}
              />
            </div>

            <div className="component-card" style={{ gridColumn: '1 / -1' }}>
              <h4>ErrorCard (503)</h4>
              <ErrorCard
                title="Ошибка"
                text="Пример отображения ошибки 503"
                animation={errorAnimation503}
              />
            </div>

            <div className="component-card">
              <h4>LoadingCard</h4>
              <p style={{ marginBottom: '12px', fontSize: '14px', color: '#666' }}>
                Компонент для отображения состояния загрузки. Перекрывает весь контент Layout.
              </p>
              <Button
                title="Показать загрузку"
                onClick={() => {
                  setLoadingCardLoading(false);
                  // Небольшая задержка, чтобы гарантировать изменение состояния
                  setTimeout(() => {
                    setLoadingCardLoading(true);
                  }, 10);
                }}
              />
            </div>

            <div className="component-card" style={{ gridColumn: 'span 2' }}>
              <h4>ElementsList</h4>
              <Form form={form}>
                <ElementsList
                  formName="elements"
                  formData={[
                    { name: 'Иван Иванов', email: 'ivan@example.com' },
                    { name: 'Петр Петров', email: 'petr@example.com' },
                  ]}
                />
              </Form>
            </div>

            <div className="component-card">
              <h4>FormItem</h4>
              <Form form={form}>
                <FormItem
                  title="Название поля"
                  tooltip="Это подсказка для поля"
                  name="exampleField"
                >
                  <InputText placeholder="Введите значение" rows={2} />
                </FormItem>
              </Form>
            </div>
          </div>
        </section>

        {/* Widgets */}
        <section className="components-section">
          <h3 className="section-title">Widgets</h3>
          <div className="components-grid">
            <div className="component-card" style={{ gridColumn: 'span 2' }}>
              <h4>NavigationBar</h4>
              <NavigationBar
                breadcrumbs={[
                  { label: 'Главная', onClick: () => navigate('/') },
                  { label: 'Компоненты' },
                ]}
                showHome={true}
                showBack={true}
                onHomeClick={() => navigate('/')}
                onBack={() => navigate('/')}
              />
            </div>

            <div className="component-card" style={{ gridColumn: 'span 2' }}>
              <h4>UserInfo</h4>
              <UserInfo
                userCabinet={{
                  id: 1,
                  hsnils: '12345678901',
                  employee_full_name: 'Иванов Иван Иванович',
                  employee_department: 'Отдел разработки',
                  employee_division: 'Инженер-программист',
                }}
                employeeData={{
                  fullName: 'Иванов Иван Иванович',
                  department: 'Отдел разработки',
                  division: 'СИУС',
                  jobTitle: 'Инженер-программист',
                }}
              />
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default ComponentsPage;
