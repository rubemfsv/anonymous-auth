export interface KeyPairResult {
  publicKey: string;
  privateKey: string;
}

export interface ICryptoKeyPair {
  generateMnemonic(): string;
  deriveKeyPair(mnemonic: string): Promise<KeyPairResult>;
  sign(message: string, privateKey: string): Promise<string>;
  verify(message: string, signature: string, publicKey: string): Promise<boolean>;
}
