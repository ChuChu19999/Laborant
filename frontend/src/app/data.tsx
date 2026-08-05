import type { ReactElement } from 'react';
import EquipmentPage from '../pages/EquipmentPage/EquipmentPage';
import HelpPage from '../pages/HelpPage/HelpPage';
import LaboratoryManagementPage from '../pages/LaboratoryManagementPage/LaboratoryManagementPage';
import MainPage from '../pages/MainPage/MainPage';
import NdNormsPage from '../pages/NdNormsPage/NdNormsPage';
import ProtocolsPage from '../pages/ProtocolsPage/ProtocolsPage';
import RolesPage from '../pages/RolesPage/RolesPage';
import SamplesPage from '../pages/SamplesPage/SamplesPage';
import SamplingLocationsPage from '../pages/SamplingLocationsPage/SamplingLocationsPage';
import TestObjectsPage from '../pages/TestObjectsPage/TestObjectsPage';
import {
  AimAntdIcon,
  BookTextIcon,
  CircleHelpIcon,
  ExperimentAntdIcon,
  FileTextIcon,
  FlaskIcon,
  HomeIcon,
  MapPinIcon,
  SettingsIcon,
  UsersIcon,
  WrenchIcon,
} from '../shared/ui/icons';
import type { SidebarIconComponent, SidebarRouteItem } from '../widgets/SideBar';

export type RouterDataItem = SidebarRouteItem & {
  element?: ReactElement;
  children?: RouterDataItem[];
};

export type { SidebarIconComponent };

export const routersData: RouterDataItem[] = [
  {
    label: 'Главная',
    path: '/',
    Icon: HomeIcon,
    element: <MainPage />,
  },
  {
    label: 'Поступления проб',
    path: '/samples',
    Icon: ExperimentAntdIcon,
    element: <SamplesPage />,
  },
  {
    label: 'Протоколы',
    path: '/protocols',
    Icon: FileTextIcon,
    element: <ProtocolsPage />,
  },
  {
    label: 'Справочники',
    path: '/__directories',
    Icon: BookTextIcon,
    menuGroup: true,
    children: [
      {
        label: 'Приборы',
        path: '/equipment',
        Icon: WrenchIcon,
        element: <EquipmentPage />,
      },
      {
        label: 'Места отбора проб',
        path: '/sampling-locations',
        Icon: MapPinIcon,
        element: <SamplingLocationsPage />,
      },
      {
        label: 'Нормы НД',
        path: '/nd-norms',
        Icon: BookTextIcon,
        element: <NdNormsPage />,
      },
    ],
  },
  {
    label: 'Администрирование',
    path: '/__administration',
    Icon: SettingsIcon,
    menuGroup: true,
    children: [
      {
        label: 'Управление лабораториями',
        path: '/laboratory-management',
        Icon: FlaskIcon,
        element: <LaboratoryManagementPage />,
      },
      {
        label: 'Объекты испытаний',
        path: '/test-objects',
        Icon: AimAntdIcon,
        element: <TestObjectsPage />,
      },
      {
        label: 'Роли',
        path: '/roles',
        Icon: UsersIcon,
        element: <RolesPage />,
      },
    ],
  },
  {
    label: 'Помощь',
    path: '/help',
    Icon: CircleHelpIcon,
    element: <HelpPage />,
  },
];
