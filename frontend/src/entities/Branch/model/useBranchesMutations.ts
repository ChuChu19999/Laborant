import { samplingLocationKeys } from '@/entities/SamplingLocation/@x/Branch';
import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import { type Branch, type BranchCreate, type BranchUpdate, branchKeys, branchesApi } from '../api';

/** Создаёт филиал. */
export const useCreateBranch = () => {
  return useAutoInvalidateMutation<Branch, unknown, BranchCreate>(
    data => branchesApi.createBranch(data),
    [branchKeys.all],
    {
      onSuccess: () => {
        notify.success('Филиал успешно добавлен');
      },
    }
  );
};

/** Обновляет филиал. */
export const useUpdateBranch = () => {
  return useAutoInvalidateMutation<Branch, unknown, { id: number; data: BranchUpdate }>(
    ({ id, data }) => branchesApi.updateBranch(id, data),
    [branchKeys.all],
    {
      onSuccess: () => {
        notify.success('Филиал успешно обновлён');
      },
    }
  );
};

/** Удаляет филиал и связанные места отбора. */
export const useDeleteBranch = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => branchesApi.deleteBranch(id),
    [branchKeys.all, samplingLocationKeys.all],
    {
      onSuccess: () => {
        notify.success('Филиал и все его точки отбора проб успешно удалены');
      },
    }
  );
};
