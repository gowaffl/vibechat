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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/46a05f2d-60bc-49f4-9932-8a6a3fb39c17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:21',message:'[MMKV PERSIST] Persisting cache to MMKV',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    storage.set('REACT_QUERY_OFFLINE_CACHE', JSON.stringify(client));
  },
  restoreClient: async () => {
    const value = storage.getString('REACT_QUERY_OFFLINE_CACHE');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/46a05f2d-60bc-49f4-9932-8a6a3fb39c17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:26',message:'[MMKV RESTORE] Restoring cache from MMKV',data:{hasValue:!!value,valueLength:value?.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return value ? JSON.parse(value) : undefined;
  },
  removeClient: async () => {
    storage.delete('REACT_QUERY_OFFLINE_CACHE');
  },
};

