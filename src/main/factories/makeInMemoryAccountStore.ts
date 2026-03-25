/**
 * Factory: creates a single shared InMemoryAccountStore instance.
 *
 * The same instance is used for both AddAccount and FindAccount contexts,
 * because both operations need access to the same in-memory data.
 * In a real app, this would be replaced by a remote API / database client.
 */

import { InMemoryAccountStore } from '@/infra/store/InMemoryAccountStore';

const store = new InMemoryAccountStore();

export const makeInMemoryAddAccount = () => store;
export const makeInMemoryFindAccount = () => store;
