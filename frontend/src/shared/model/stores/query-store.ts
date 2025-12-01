import { create } from 'zustand';
import { logger } from '../../lib/zustand/middleware';
import type { QueryState } from '../../lib/zustand/types';

interface QueryStore {
  // Метод для сброса всех query состояний
  resetAllQueries: () => void;
}

/**
 * Дефолтное состояние для query параметров
 * Используется при расширении store для инициализации новых query состояний
 */
export const defaultQueryState: QueryState = {
  page: 1,
  pageSize: 20,
};

/**
 * Query Store - управление параметрами запросов
 * Использует logger middleware для логирования изменений в режиме разработки
 */
export const useQueryStore = create<QueryStore>()(
  logger(() => ({
    // Сброс всех query состояний
    resetAllQueries: () => {
      // В базовом шаблоне это пустая функция
      // При расширении store добавьте сброс всех специфичных query состояний
    },
  }))
);
