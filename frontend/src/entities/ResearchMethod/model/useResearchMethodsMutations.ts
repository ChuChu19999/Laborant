import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import {
  researchApi,
  type ResearchMethod,
  type ResearchMethodCreate,
  type ResearchMethodGroup,
  type ResearchMethodGroupCreate,
  researchMethodGroupKeys,
  researchMethodKeys,
} from '../api';

/** Создаёт метод исследования. */
export const useCreateResearchMethod = () => {
  return useAutoInvalidateMutation<ResearchMethod, unknown, ResearchMethodCreate>(
    data => researchApi.createResearchMethod(data),
    [researchMethodKeys.all],
    {
      onSuccess: () => {
        notify.success('Метод исследования успешно добавлен');
      },
    }
  );
};

/** Обновляет метод исследования. */
export const useUpdateResearchMethod = () => {
  return useAutoInvalidateMutation<
    ResearchMethod,
    unknown,
    { id: number; data: Partial<ResearchMethodCreate> }
  >(({ id, data }) => researchApi.updateResearchMethod(id, data), [researchMethodKeys.all], {
    onSuccess: () => {
      notify.success('Метод исследования успешно обновлён');
    },
  });
};

/** Скрывает метод исследования. */
export const useDeleteResearchMethod = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => researchApi.deleteResearchMethod(id),
    [researchMethodKeys.all],
    {
      onSuccess: () => {
        notify.success('Метод исследования скрыт');
      },
    }
  );
};

/** Создаёт группу методов исследования. */
export const useCreateResearchMethodGroup = () => {
  return useAutoInvalidateMutation<ResearchMethodGroup, unknown, ResearchMethodGroupCreate>(
    data => researchApi.createResearchMethodGroup(data),
    [researchMethodGroupKeys.all],
    {
      onSuccess: () => {
        notify.success('Группа методов исследования успешно добавлена');
      },
    }
  );
};

/** Удаляет группу методов исследования. */
export const useDeleteResearchMethodGroup = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => researchApi.deleteResearchMethodGroup(id),
    [researchMethodGroupKeys.all, researchMethodKeys.all],
    {
      onSuccess: () => {
        notify.success('Группа методов исследования удалена');
      },
    }
  );
};

/** Заменяет метод новой версией (старый скрывается, создаётся новый, группа обновляется при необходимости). */
export const useReplaceResearchMethod = () => {
  return useAutoInvalidateMutation<
    ResearchMethod,
    unknown,
    {
      editMethodId: number;
      data: ResearchMethodCreate;
      groupId?: number;
    }
  >(
    async ({ editMethodId, data, groupId }) => {
      let groupMethodIds: number[] | null = null;
      if (groupId != null) {
        const group = await researchApi.getResearchMethodGroup(groupId, {
          include_deleted: true,
        });
        groupMethodIds = group.methods.map(m => m.id);
      }
      await researchApi.deleteResearchMethod(editMethodId);
      const response = await researchApi.createResearchMethod(data);
      if (groupId != null && groupMethodIds != null) {
        const newMethodIds = groupMethodIds.map(id => (id === editMethodId ? response.id : id));
        if (!newMethodIds.includes(editMethodId)) {
          newMethodIds.push(editMethodId);
        }
        await researchApi.updateResearchMethodGroup(groupId, { method_ids: newMethodIds });
      }
      return response;
    },
    [researchMethodKeys.all, researchMethodGroupKeys.all],
    {
      onSuccess: () => {
        notify.success('Метод исследования успешно обновлён');
      },
    }
  );
};

/** Пакетно обновляет порядок сортировки методов и групп. */
export const useBatchUpdateSortOrder = () => {
  return useAutoInvalidateMutation<
    void,
    unknown,
    { id: number; type: 'method' | 'group'; sort_order: number }[]
  >(
    items => researchApi.batchUpdateSortOrder(items),
    [researchMethodKeys.all, researchMethodGroupKeys.all],
    {
      onSuccess: () => {
        notify.success('Порядок сортировки успешно обновлён');
      },
    }
  );
};
