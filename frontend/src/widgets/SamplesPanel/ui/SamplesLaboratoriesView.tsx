import { LaboratoryCard } from '@/entities/Laboratory';
import { Layout } from '@/shared/ui/Layout';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import type { Laboratory } from '@/entities/Laboratory';

interface SamplesLaboratoriesViewProps {
  breadcrumbs: { label: string; onClick?: () => void }[];
  laboratories: Laboratory[];
  onLaboratoryClick: (laboratory: Laboratory) => void;
  onBack: () => void;
  canAccessLaboratory: (laboratoryId: number) => boolean;
}

const SamplesLaboratoriesView = ({
  breadcrumbs,
  laboratories,
  onLaboratoryClick,
  onBack,
  canAccessLaboratory,
}: SamplesLaboratoriesViewProps) => {
  return (
    <Layout title="Поступления проб">
      <NavigationBar breadcrumbs={breadcrumbs} onBack={onBack} showBack={true} />
      <div className="samples-page-laboratories">
        <div className="samples-page-laboratories-grid">
          {laboratories.map(laboratoryItem => (
            <LaboratoryCard
              key={laboratoryItem.id}
              laboratory={laboratoryItem}
              onClick={onLaboratoryClick}
              showActions={false}
              disabled={!canAccessLaboratory(laboratoryItem.id)}
            />
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default SamplesLaboratoriesView;
