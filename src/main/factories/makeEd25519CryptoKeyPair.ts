import { Ed25519CryptoKeyPair } from '@/infra/crypto/Ed25519CryptoKeyPair';

export const makeEd25519CryptoKeyPair = () => new Ed25519CryptoKeyPair();
