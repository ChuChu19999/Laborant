import {
  BiHelpCircle,
  BiHomeAlt2,
  BiTestTube,
  BiFile,
  BiMap,
  BiTargetLock,
  BiUser,
  BiBook,
} from 'react-icons/bi';
import { FaFlask } from 'react-icons/fa';
import EquipmentPage from '../pages/EquipmentPage/EquipmentPage';
import HelpPage from '../pages/HelpPage/HelpPage';
import MainPage from '../pages/MainPage/MainPage';
import NdNormsPage from '../pages/NdNormsPage/NdNormsPage';
import ProtocolsPage from '../pages/ProtocolsPage/ProtocolsPage';
import RolesPage from '../pages/RolesPage/RolesPage';
import SamplesPage from '../pages/SamplesPage/SamplesPage';
import SamplingLocationsPage from '../pages/SamplingLocationsPage/SamplingLocationsPage';
import TestObjectsPage from '../pages/TestObjectsPage/TestObjectsPage';

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
    label: 'Приборы',
    path: '/equipment',
    icon: <FaFlask size={20} />,
    element: <EquipmentPage />,
  },
  {
    label: 'Места отбора проб',
    path: '/sampling-locations',
    icon: <BiMap size={20} />,
    element: <SamplingLocationsPage />,
  },
  {
    label: 'Нормы НД',
    path: '/nd-norms',
    icon: <BiBook size={20} />,
    element: <NdNormsPage />,
  },
  {
    label: 'Объекты испытаний',
    path: '/test-objects',
    icon: <BiTargetLock size={20} />,
    element: <TestObjectsPage />,
  },
  {
    label: 'Роли',
    path: '/roles',
    icon: <BiUser size={20} />,
    element: <RolesPage />,
  },
  {
    label: 'Помощь',
    path: '/help',
    icon: <BiHelpCircle size={20} />,
    element: <HelpPage />,
  },
];
