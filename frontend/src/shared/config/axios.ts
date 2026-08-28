import axios from 'axios';
import { toDisplayString } from '../lib/formatting';
import { API_URL } from './process';

export const axiosInstance = axios.create({
  baseURL: API_URL,
  paramsSerializer: (params: Record<string, unknown>) => {
    const searchParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (Array.isArray(value)) {
        value.forEach(item => {
          searchParams.append(key, toDisplayString(item));
        });
      } else if (value !== null && value !== undefined) {
        searchParams.append(key, toDisplayString(value));
      }
    });
    return searchParams.toString();
  },
});
