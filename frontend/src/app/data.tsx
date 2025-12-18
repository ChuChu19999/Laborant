import { BiHelpCircle, BiHomeAlt2, BiTestTube, BiFile } from 'react-icons/bi';
import HelpPage from '../pages/HelpPage/HelpPage';
import MainPage from '../pages/MainPage/MainPage';
import ProtocolsPage from '../pages/ProtocolsPage/ProtocolsPage';
import SamplesPage from '../pages/SamplesPage/SamplesPage';

export const routersData = [
  {
    label: 'Главная',
    path: '/',
    icon: <BiHomeAlt2 size={20} />,
    element: <MainPage />,
  },
  {
    label: 'Поступления проб',
    path: '/samples',
    icon: <BiTestTube size={20} />,
    element: <SamplesPage />,
  },
  {
    label: 'Протоколы',
    path: '/protocols',
    icon: <BiFile size={20} />,
    element: <ProtocolsPage />,
  },
  {
    label: 'Помощь',
    path: '/help',
    icon: <BiHelpCircle size={20} />,
    element: <HelpPage />,
  },
];
