import { lazy, Suspense, type ComponentType } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Spin } from '@/shared/ui/Spin';
import type { FillCalculationsModalProps } from './ui/FillCalculationsModal';
import './ui/FillCalculationsModal.css';

const LazyFillCalculationsModal = lazy(() => import('./ui/FillCalculationsModal'));

const FillCalculationsModalFallback = ({ onClose, sample }: FillCalculationsModalProps) => (
  <Modal
    header={`Расчёты для пробы ${sample.registration_number}`}
    onClose={onClose}
    onCancel={onClose}
    showEditButton={false}
    editable={false}
    modalWidth="1800"
  >
    <div className="fill-calculations-modal-content fill-calculations-modal-content--loading">
      <Spin size="large" />
    </div>
  </Modal>
);

export const FillCalculationsModal: ComponentType<FillCalculationsModalProps> = props => (
  <Suspense fallback={<FillCalculationsModalFallback {...props} />}>
    <LazyFillCalculationsModal {...props} />
  </Suspense>
);
