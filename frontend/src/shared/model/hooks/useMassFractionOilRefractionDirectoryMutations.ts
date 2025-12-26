import { message } from 'antd';
import {
  refractionTablesApi,
  type MassFractionOilRefractionTable,
  type MassFractionOilRefractionTableCreate,
  type MassFractionOilRefractionTableUpdate,
  type BulkUpdateRequest,
} from '../../api/refractionTables';
import { useAutoInvalidateMutation } from '../lib/useMutation';

export const useCreateMassFractionOilRefractionTable = () => {
  return useAutoInvalidateMutation<
    MassFractionOilRefractionTable,
    unknown,
    MassFractionOilRefractionTableCreate
  >(data => refractionTablesApi.createRefractionTable(data), [['refraction-tables']], {
    onSuccess: () => {
      message.success('Запись справочника успешно добавлена');
    },
  });
};

export const useUpdateMassFractionOilRefractionTable = () => {
  return useAutoInvalidateMutation<
    MassFractionOilRefractionTable,
    unknown,
    { id: number; data: MassFractionOilRefractionTableUpdate }
  >(
    ({ id, data }) => refractionTablesApi.updateRefractionTable(id, data),
    [['refraction-tables']],
    {
      onSuccess: () => {
        message.success('Запись справочника успешно обновлена');
      },
    }
  );
};

export const useDeleteMassFractionOilRefractionTable = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => refractionTablesApi.deleteRefractionTable(id),
    [['refraction-tables']],
    {
      onSuccess: () => {
        message.success('Запись справочника успешно удалена');
      },
    }
  );
};

export const useBulkUpdateMassFractionOilRefractionTable = () => {
  return useAutoInvalidateMutation<{ message: string }, unknown, BulkUpdateRequest>(
    data => refractionTablesApi.bulkUpdate(data),
    [['refraction-tables']],
    {
      onSuccess: () => {
        message.success('Справочник успешно обновлен');
      },
    }
  );
};
