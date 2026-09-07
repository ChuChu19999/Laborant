import {
  AimAntdIcon,
  BookTextIcon,
  CircleHelpIcon,
  ExperimentAntdIcon,
  FileTextIcon,
  FlaskIcon,
  HomeIcon,
  LineChartAntdIcon,
  MapPinIcon,
  PulseIcon,
  SettingsIcon,
  UsersIcon,
  WrenchIcon,
} from '@/shared/ui/icons';
import type { SidebarRouteItem } from '../ui/SideBar';

export const sidebarRoutes: SidebarRouteItem[] = [
  {
    label: 'Главная',
    path: '/',
    Icon: HomeIcon,
  },
  {
    label: 'Поступления проб',
    path: '/samples',
    Icon: ExperimentAntdIcon,
  },
  {
    label: 'Протоколы',
    path: '/protocols',
    Icon: FileTextIcon,
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
      },
      {
        label: 'Места отбора проб',
        path: '/sampling-locations',
        Icon: MapPinIcon,
      },
      {
        label: 'Нормы НД',
        path: '/nd-norms',
        Icon: BookTextIcon,
      },
      {
        label: 'Градуировочный график',
        path: '/refraction-tables',
        Icon: LineChartAntdIcon,
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
      },
      {
        label: 'Объекты испытаний',
        path: '/test-objects',
        Icon: AimAntdIcon,
      },
      {
        label: 'Роли',
        path: '/roles',
        Icon: UsersIcon,
      },
      {
        label: 'Мониторинг',
        path: '/monitoring',
        Icon: PulseIcon,
      },
    ],
  },
  {
    label: 'Помощь',
    path: '/help',
    Icon: CircleHelpIcon,
  },
];
