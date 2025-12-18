import { message } from 'antd';
import {
  samplingLocationsApi,
  type Branch,
  type BranchCreate,
  type BranchUpdate,
  type SamplingLocation,
  type SamplingLocationCreate,
  type SamplingLocationUpdate,
} from '../../api/samplingLocations';
import { useAutoInvalidateMutation } from '../lib/useMutation';

export const useCreateBranch = () => {
  return useAutoInvalidateMutation<Branch, unknown, BranchCreate>(
    data => samplingLocationsApi.createBranch(data),
    [['sampling-locations', 'branches']],
    {
      onSuccess: () => {
        message.success('Филиал успешно создан');
      },
    }
  );
};

export const useUpdateBranch = () => {
  return useAutoInvalidateMutation<Branch, unknown, { id: number; data: BranchUpdate }>(
    ({ id, data }) => samplingLocationsApi.updateBranch(id, data),
    [['sampling-locations', 'branches']],
    {
      onSuccess: () => {
        message.success('Филиал успешно обновлен');
      },
    }
  );
};

export const useDeleteBranch = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => samplingLocationsApi.deleteBranch(id),
    [
      ['sampling-locations', 'branches'],
      ['sampling-locations', 'items'],
    ],
    {
      onSuccess: () => {
        message.success('Филиал и все его точки отбора проб успешно удалены');
      },
    }
  );
};

export const useCreateSamplingLocation = () => {
  return useAutoInvalidateMutation<SamplingLocation, unknown, SamplingLocationCreate>(
    data => samplingLocationsApi.createSamplingLocation(data),
    [['sampling-locations', 'items']],
    {
      onSuccess: () => {
        message.success('Место отбора пробы успешно создано');
      },
    }
  );
};

export const useUpdateSamplingLocation = () => {
  return useAutoInvalidateMutation<
    SamplingLocation,
    unknown,
    { id: number; data: SamplingLocationUpdate }
  >(
    ({ id, data }) => samplingLocationsApi.updateSamplingLocation(id, data),
    [['sampling-locations', 'items']],
    {
      onSuccess: () => {
        message.success('Место отбора пробы успешно обновлено');
      },
    }
  );
};

export const useDeleteSamplingLocation = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => samplingLocationsApi.deleteSamplingLocation(id),
    [['sampling-locations', 'items']],
    {
      onSuccess: () => {
        message.success('Место отбора пробы успешно удалено');
      },
    }
  );
};
