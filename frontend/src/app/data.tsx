import { BiHelpCircle, BiHomeAlt2, BiFileBlank, BiCog, BiMap, BiSpreadsheet } from 'react-icons/bi';
import { FaFlask } from 'react-icons/fa';
import EquipmentPage from '../pages/EquipmentPage/EquipmentPage';
import HelpPage from '../pages/HelpPage/HelpPage';
import MainPage from '../pages/MainPage/MainPage';
import ProtocolsPage from '../pages/ProtocolsPage/ProtocolsPage';
import ReportsPage from '../pages/ReportsPage/ReportsPage';
import SamplesPage from '../pages/SamplesPage/SamplesPage';
import SamplingLocationsPage from '../pages/SamplingLocationsPage/SamplingLocationsPage';

export const routersData = [
  {
    label: 'Главная',
    path: '/',
    icon: <BiHomeAlt2 size={20} />,
    element: <MainPage />,
  },
  {
    label: 'Пробы',
    path: '/samples',
    icon: <FaFlask size={20} />,
    element: <SamplesPage />,
  },
  {
    label: 'Протоколы',
    path: '/protocols',
    icon: <BiFileBlank size={20} />,
    element: <ProtocolsPage />,
  },
  {
    label: 'Отчеты',
    path: '/reports',
    icon: <BiSpreadsheet size={20} />,
    element: <ReportsPage />,
  },
  {
    label: 'Оборудование',
    path: '/equipment',
    icon: <BiCog size={20} />,
    element: <EquipmentPage />,
  },
  {
    label: 'Места отбора проб',
    path: '/sampling-locations',
    icon: <BiMap size={20} />,
    element: <SamplingLocationsPage />,
  },
  {
    label: 'Помощь',
    path: '/help',
    icon: <BiHelpCircle size={20} />,
    element: <HelpPage />,
  },
];
