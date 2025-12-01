import axios from 'axios';
import { API_URL } from './process';

export const axiosInstance = axios.create({
  baseURL: API_URL,
  paramsSerializer: params => {
    const searchParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (Array.isArray(value)) {
        // Для массивов добавляем каждый элемент с одним и тем же ключом
        value.forEach(item => {
          searchParams.append(key, String(item));
        });
      } else if (value !== null && value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    return searchParams.toString();
  },
});
