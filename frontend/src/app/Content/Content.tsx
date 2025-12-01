import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SideBar } from '../../widgets/SideBar';
import './Content.css';

interface ContentProps {
  username: string;
  isAdmin: boolean;
}

const Content = ({ username, isAdmin }: ContentProps) => {
  const [minimize, setMinimize] = useState(false);

  const handleMinimizeChange = (value: boolean) => {
    setMinimize(value);
  };

  return (
    <div className="content-wrapper">
      <SideBar username={username} isAdmin={isAdmin} onMinimizeChange={handleMinimizeChange} />
      <Outlet context={{ minimize, isAdmin }} />
    </div>
  );
};

export default Content;
