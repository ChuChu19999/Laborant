import { createLazyFeature } from '@/shared/lib/lazy';
import type { MassFractionOilRefractionDirectoryModalProps } from './ui/MassFractionOilRefractionDirectoryModal';
import type { ComponentType } from 'react';

export const MassFractionOilRefractionDirectoryModal: ComponentType<MassFractionOilRefractionDirectoryModalProps> =
  createLazyFeature(() => import('./ui/MassFractionOilRefractionDirectoryModal'));
