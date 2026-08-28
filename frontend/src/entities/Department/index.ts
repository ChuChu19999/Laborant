export { type Department } from './api/departments';
export { useDepartmentsByLaboratory } from './model/useDepartments';
export {
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
} from './model/useDepartmentsMutations';
export { default as AddDepartmentCard } from './ui/AddDepartmentCard/AddDepartmentCard';
export { default as DepartmentCard } from './ui/DepartmentCard/DepartmentCard';
export { default as DepartmentFormFields } from './ui/DepartmentFormFields/DepartmentFormFields';
export type { DepartmentFormValues } from './ui/DepartmentFormFields/DepartmentFormFields';
