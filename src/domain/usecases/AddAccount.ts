import type { AccountModel } from '@/domain/models';

export interface IAddAccount {
  add(params: AddAccount.Params): Promise<AddAccount.Model>;
}

export namespace AddAccount {
  export type Params = {
    username: string;
    publicKey: string;
    mnemonicHashes: string[];
  };

  export type Model = AccountModel;
}
