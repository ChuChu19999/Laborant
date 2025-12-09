import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import { IconButton } from '@mui/material';
import { MethodListItem } from '../../entities/MethodListItem';
import { laboratoriesApi } from '../../shared/api/laboratories';
import Layout from '../../shared/ui/Layout/Layout';
import { NavigationBar } from '../../widgets/NavigationBar';
import { SplitPanel } from '../../widgets/SplitPanel';
import type { Laboratory, Department } from '../../shared/api/laboratories';
import './AdminPage.css';

interface Method {
  id: number;
  name: string;
}

const AdminPage: React.FC = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const navigate = useNavigate();
  const [methods] = useState<Method[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [showAddButton] = useState(true);
  const [laboratory, setLaboratory] = useState<Laboratory | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (laboratoryId) {
        try {
          const labId = parseInt(laboratoryId, 10);
          if (!isNaN(labId)) {
            const labData = await laboratoriesApi.getLaboratory(labId);
            setLaboratory(labData);
          }
        } catch (error) {
          console.error('Ошибка при загрузке лаборатории:', error);
        }
      }

      if (departmentId && laboratoryId) {
        try {
          const deptId = parseInt(departmentId, 10);
          const labId = parseInt(laboratoryId, 10);
          if (!isNaN(deptId) && !isNaN(labId)) {
            const departments = await laboratoriesApi.getDepartmentsByLaboratory(labId);
            const foundDepartment = departments.find(dept => dept.id === deptId);
            if (foundDepartment) {
              setDepartment(foundDepartment);
            }
          }
        } catch (error) {
          console.error('Ошибка при загрузке подразделения:', error);
        }
      }
    };

    fetchData();
  }, [laboratoryId, departmentId]);

  const handleBack = () => {
    if (laboratoryId) {
      navigate(`/?page=laboratory-management&viewMode=departments&laboratoryId=${laboratoryId}`);
    } else {
      navigate('/?page=laboratory-management');
    }
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const handleBackToLaboratories = () => {
    navigate('/?page=laboratory-management');
  };

  const getBreadcrumbs = (): Array<{ label: string; onClick?: () => void }> => {
    const breadcrumbs: Array<{ label: string; onClick?: () => void }> = [
      { label: 'Главная', onClick: handleBackToHome },
    ];

    breadcrumbs.push({ label: 'Управление лабораториями', onClick: handleBackToLaboratories });

    if (laboratory) {
      const labBreadcrumb = departmentId
        ? { label: laboratory.name, onClick: handleBack }
        : { label: laboratory.name };
      breadcrumbs.push(labBreadcrumb);
    }

    if (departmentId) {
      const departmentName = department ? department.name : 'Загрузка...';
      breadcrumbs.push({ label: departmentName });
    }

    return breadcrumbs;
  };

  const handleMethodClick = (methodId: number) => {
    setSelectedMethodId(methodId);
  };

  const handleMethodDelete = (methodId: number) => {
    // TODO: Добавить логику удаления
    console.log('Delete method:', methodId);
  };

  const handleAddMethod = () => {
    // TODO: Добавить логику добавления метода
    console.log('Add method');
  };

  const hasNoMethods = methods.length === 0;

  const leftPanel = (
    <div className="admin-left-panel">
      <div className="admin-left-panel-header">
        <h3 className="admin-left-panel-title">Методы исследования</h3>
        {showAddButton && (
          <IconButton
            aria-label="добавить метод"
            size="small"
            onClick={handleAddMethod}
            className="admin-left-panel-add-button"
          >
            <AddIcon fontSize="small" className="admin-left-panel-add-icon" />
          </IconButton>
        )}
      </div>
      <div className="admin-left-panel-content">
        {hasNoMethods ? (
          <div className="admin-left-panel-empty">Нет активных методов исследования</div>
        ) : (
          <div className="admin-left-panel-methods">
            {methods.map(method => (
              <MethodListItem
                key={method.id}
                name={method.name}
                isActive={selectedMethodId === method.id}
                isEditable={true}
                onClick={() => handleMethodClick(method.id)}
                onDelete={() => handleMethodDelete(method.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const rightPanel = (
    <div className="admin-right-panel">
      {hasNoMethods ? (
        <div className="admin-right-panel-empty">
          <h3 className="admin-right-panel-empty-title">Методы исследования отсутствуют</h3>
          <p className="admin-right-panel-empty-description">
            Добавьте первый метод исследования, нажав на кнопку "+" в левой панели
          </p>
        </div>
      ) : (
        <p>Панель расчетов будет здесь</p>
      )}
    </div>
  );

  return (
    <Layout title="Администрирование">
      <NavigationBar breadcrumbs={getBreadcrumbs()} onBack={handleBack} showBack={true} />
      <SplitPanel leftPanel={leftPanel} rightPanel={rightPanel} />
    </Layout>
  );
};

export default AdminPage;
