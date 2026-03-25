import { createContext } from 'react';
import type { IAddAccount } from '@/domain/usecases';
import type { IFindAccount } from '@/domain/usecases';
import type { ICryptoKeyPair } from '@/data/protocols/crypto';

export const AddAccountContext = createContext<IAddAccount | null>(null);
export const CryptoKeyPairContext = createContext<ICryptoKeyPair | null>(null);
export const FindAccountContext = createContext<IFindAccount | null>(null);
