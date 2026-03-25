import { LocalStorageAdapter } from '@/infra/cache/LocalStorageAdapter';

export const makeLocalStorageAdapter = () => new LocalStorageAdapter();
