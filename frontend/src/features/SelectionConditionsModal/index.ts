import { createLazyFeature } from '@/shared/lib/lazy';
import type { SelectionConditionsModalProps } from './ui/SelectionConditionsModal';
import type { ComponentType } from 'react';

export const SelectionConditionsModal: ComponentType<SelectionConditionsModalProps> =
  createLazyFeature(() => import('./ui/SelectionConditionsModal'));
