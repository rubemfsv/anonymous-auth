export namespace FindAccount {
  export type ByUsernameResult = {
    publicKey: string;
    mnemonicHashes: string[];
  } | null;
}

export interface IFindAccount {
  findByPublicKey(publicKey: string): Promise<boolean>;
  findByUsername(username: string): Promise<FindAccount.ByUsernameResult>;
}
