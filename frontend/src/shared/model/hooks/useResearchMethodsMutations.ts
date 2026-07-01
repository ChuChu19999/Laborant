import { message } from 'antd';
import {
  researchApi,
  type ResearchMethod,
  type ResearchMethodCreate,
  type ResearchMethodGroup,
  type ResearchMethodGroupCreate,
} from '../../api/research';
import { useAutoInvalidateMutation } from '../lib/useMutation';

/**
 * Хук для добавления метода исследования
 */
export const useCreateResearchMethod = () => {
  return useAutoInvalidateMutation<ResearchMethod, unknown, ResearchMethodCreate>(
    data => researchApi.createResearchMethod(data),
    [['research-methods']],
    {
      onSuccess: () => {
        message.success('Метод исследования успешно добавлен');
      },
    }
  );
};

/**
 * Хук для обновления метода исследования
 */
export const useUpdateResearchMethod = () => {
  return useAutoInvalidateMutation<
    ResearchMethod,
    unknown,
    { id: number; data: Partial<ResearchMethodCreate> }
  >(({ id, data }) => researchApi.updateResearchMethod(id, data), [['research-methods']], {
    onSuccess: () => {
      message.success('Метод исследования успешно обновлен');
    },
  });
};

/**
 * Хук для удаления метода исследования
 */
export const useDeleteResearchMethod = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => researchApi.deleteResearchMethod(id),
    [['research-methods']],
    {
      onSuccess: () => {
        message.success('Метод исследования скрыт');
      },
    }
  );
};

/**
 * Хук для обновления порядка сортировки метода исследования
 */
export const useUpdateResearchMethodSortOrder = () => {
  return useAutoInvalidateMutation<ResearchMethod, unknown, { id: number; sortOrder: number }>(
    ({ id, sortOrder }) => researchApi.updateResearchMethodSortOrder(id, sortOrder),
    [['research-methods']],
    {
      onSuccess: () => {
        message.success('Порядок сортировки метода обновлен');
      },
    }
  );
};

/**
 * Хук для добавления группы методов исследования
 */
export const useCreateResearchMethodGroup = () => {
  return useAutoInvalidateMutation<ResearchMethodGroup, unknown, ResearchMethodGroupCreate>(
    data => researchApi.createResearchMethodGroup(data),
    [['research-method-groups']],
    {
      onSuccess: () => {
        message.success('Группа методов исследования успешно добавлена');
      },
    }
  );
};

/**
 * Хук для обновления группы методов исследования
 */
export const useUpdateResearchMethodGroup = () => {
  return useAutoInvalidateMutation<
    ResearchMethodGroup,
    unknown,
    { id: number; data: Partial<ResearchMethodGroupCreate & { sort_order?: number }> }
  >(
    ({ id, data }) => researchApi.updateResearchMethodGroup(id, data),
    [['research-method-groups']],
    {
      onSuccess: () => {
        message.success('Группа методов исследования успешно обновлена');
      },
    }
  );
};

/**
 * Хук для удаления группы методов исследования
 */
export const useDeleteResearchMethodGroup = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => researchApi.deleteResearchMethodGroup(id),
    [['research-method-groups'], ['research-methods']],
    {
      onSuccess: () => {
        message.success('Группа методов исследования удалена');
      },
    }
  );
};

/**
 * Хук для пакетного обновления порядка сортировки методов и групп
 */
export const useBatchUpdateSortOrder = () => {
  return useAutoInvalidateMutation<
    void,
    unknown,
    Array<{ id: number; type: 'method' | 'group'; sort_order: number }>
  >(
    items => researchApi.batchUpdateSortOrder(items),
    [['research-methods'], ['research-method-groups']],
    {
      onSuccess: () => {
        message.success('Порядок сортировки успешно обновлен');
      },
    }
  );
};
