import { DepartmentCard } from '@/entities/Department';
import { Layout } from '@/shared/ui/Layout';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import type { Department } from '@/entities/Department';

interface SamplesDepartmentsViewProps {
  title: string;
  breadcrumbs: { label: string; onClick?: () => void }[];
  departments: Department[];
  laboratoryId: number;
  onDepartmentClick: (department: Department) => void;
  onBack: () => void;
  canAccessDepartment: (laboratoryId: number, departmentId: number) => boolean;
}

const SamplesDepartmentsView = ({
  title,
  breadcrumbs,
  departments,
  laboratoryId,
  onDepartmentClick,
  onBack,
  canAccessDepartment,
}: SamplesDepartmentsViewProps) => {
  return (
    <Layout title={title}>
      <NavigationBar breadcrumbs={breadcrumbs} onBack={onBack} showBack={true} />
      <div className="samples-page-departments">
        <div className="samples-page-departments-grid">
          {departments.map((department, index) => (
            <DepartmentCard
              key={department.id}
              department={department}
              onClick={onDepartmentClick}
              showActions={false}
              iconIndex={index}
              disabled={!canAccessDepartment(laboratoryId, department.id)}
            />
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default SamplesDepartmentsView;
