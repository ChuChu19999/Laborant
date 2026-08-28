import { LaboratoryCard } from '@/entities/Laboratory';
import { Layout } from '@/shared/ui/Layout';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import type { Laboratory } from '@/entities/Laboratory';

type BreadcrumbItem = { label: string; onClick?: () => void };

interface SamplingLocationsLaboratoriesViewProps {
  breadcrumbs: BreadcrumbItem[];
  laboratories: Laboratory[];
  onLaboratoryClick: (laboratory: Laboratory) => void;
  onBack: () => void;
  canAccessLaboratory: (laboratoryId: number) => boolean;
}

const SamplingLocationsLaboratoriesView = ({
  breadcrumbs,
  laboratories,
  onLaboratoryClick,
  onBack,
  canAccessLaboratory,
}: SamplingLocationsLaboratoriesViewProps) => {
  return (
    <Layout title="Места отбора проб">
      <NavigationBar breadcrumbs={breadcrumbs} onBack={onBack} showBack={true} />
      <div className="sampling-locations-laboratories">
        <div className="sampling-locations-laboratories-grid">
          {laboratories.map(laboratory => (
            <LaboratoryCard
              key={laboratory.id}
              laboratory={laboratory}
              onClick={onLaboratoryClick}
              showActions={false}
              disabled={!canAccessLaboratory(laboratory.id)}
            />
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default SamplingLocationsLaboratoriesView;
