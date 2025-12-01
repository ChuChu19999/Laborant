import { BiHelpCircle, BiHomeAlt2, BiBook } from 'react-icons/bi';
import ComponentsPage from '../pages/ComponentsPage/ComponentsPage';
import HelpPage from '../pages/HelpPage/HelpPage';
import MainPage from '../pages/MainPage/MainPage';

export const routersData = [
  {
    label: 'Главная',
    path: '/',
    icon: <BiHomeAlt2 size={20} />,
    element: <MainPage />,
  },
  {
    label: 'Компоненты',
    path: '/components',
    icon: <BiBook size={20} />,
    element: <ComponentsPage />,
  },
  {
    label: 'Помощь',
    path: '/help',
    icon: <BiHelpCircle size={20} />,
    element: <HelpPage />,
  },
];
