import { MMKV } from 'react-native-mmkv';
import { Persister } from '@tanstack/react-query-persist-client';

export const storage = new MMKV();

export const clientStorage = {
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  getItem: (key: string) => {
    const value = storage.getString(key);
    return value === undefined ? null : value;
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
};

export const mmkvPersister: Persister = {
  persistClient: async (client: any) => {
    storage.set('REACT_QUERY_OFFLINE_CACHE', JSON.stringify(client));
  },
  restoreClient: async () => {
    const value = storage.getString('REACT_QUERY_OFFLINE_CACHE');
    return value ? JSON.parse(value) : undefined;
  },
  removeClient: async () => {
    storage.delete('REACT_QUERY_OFFLINE_CACHE');
  },
};

