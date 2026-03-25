/**
 * LocalStorageAdapter — Bridges the browser's localStorage with the
 * IGetStorage / ISetStorage protocols from the data layer.
 *
 * This keeps the presentation and domain layers decoupled from any
 * specific storage mechanism (localStorage, sessionStorage, etc.).
 */

import type { IGetStorage } from '@/data/protocols/cache/GetStorage';
import type { ISetStorage } from '@/data/protocols/cache/SetStorage';

export class LocalStorageAdapter implements IGetStorage, ISetStorage {
  set(key: string, value: object): void {
    if (value !== undefined && value !== null) {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      localStorage.removeItem(key);
    }
  }

  get(key: string): unknown {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
