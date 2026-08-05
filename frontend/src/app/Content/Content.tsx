import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SideBar } from '../../widgets/SideBar';
import { routersData } from '../data';
import type { UserPermissions } from '../../shared/api/userRole';
import './Content.css';

interface ContentProps {
  username: string;
  isAdmin: boolean;
  permissionsData: UserPermissions;
}

const Content = ({ username, isAdmin, permissionsData }: ContentProps) => {
  const [minimize, setMinimize] = useState(false);

  const handleMinimizeChange = (value: boolean) => {
    setMinimize(value);
  };

  return (
    <div className="content-wrapper">
      <SideBar
        routes={routersData}
        username={username}
        isAdmin={isAdmin}
        permissionsData={permissionsData}
        onMinimizeChange={handleMinimizeChange}
      />
      <Outlet context={{ minimize, isAdmin, permissionsData }} />
    </div>
  );
};

export default Content;
