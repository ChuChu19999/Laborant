export { type Laboratory } from './api/laboratories';
export { useLaboratoriesWithDepartments } from './model/useLaboratoriesWithDepartments';
export { useLaboratories, useLaboratory } from './model/useLaboratories';
export {
  useCreateLaboratory,
  useUpdateLaboratory,
  useDeleteLaboratory,
} from './model/useLaboratoriesMutations';
export { default as AddLaboratoryCard } from './ui/AddLaboratoryCard/AddLaboratoryCard';
export { default as LaboratoryCard } from './ui/LaboratoryCard/LaboratoryCard';
export { default as LaboratoryFormFields } from './ui/LaboratoryFormFields/LaboratoryFormFields';
export type { LaboratoryFormValues } from './ui/LaboratoryFormFields/LaboratoryFormFields';
export { buildVisibilityScopeOptions } from './lib/visibilityScopeOptions';
