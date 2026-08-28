import { DepartmentCard } from '@/entities/Department';
import { Layout } from '@/shared/ui/Layout';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import type { Department } from '@/entities/Department';

type BreadcrumbItem = { label: string; onClick?: () => void };

interface SamplingLocationsDepartmentsViewProps {
  title: string;
  breadcrumbs: BreadcrumbItem[];
  departments: Department[];
  laboratoryId: number;
  onDepartmentClick: (department: Department) => void;
  onBack: () => void;
  canAccessDepartment: (laboratoryId: number, departmentId: number) => boolean;
}

const SamplingLocationsDepartmentsView = ({
  title,
  breadcrumbs,
  departments,
  laboratoryId,
  onDepartmentClick,
  onBack,
  canAccessDepartment,
}: SamplingLocationsDepartmentsViewProps) => {
  return (
    <Layout title={title}>
      <NavigationBar breadcrumbs={breadcrumbs} onBack={onBack} showBack={true} />
      <div className="sampling-locations-departments">
        <div className="sampling-locations-departments-grid">
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

export default SamplingLocationsDepartmentsView;
