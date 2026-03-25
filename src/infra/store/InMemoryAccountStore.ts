/**
 * InMemoryAccountStore — Replaces the database layer for demo purposes.
 *
 * In the original Satlance project, accounts are persisted in Supabase (Postgres).
 * Here we use a simple in-memory Map so the auth flow works without any
 * external database. Data is lost on page refresh, which is fine for a demo.
 *
 * This class implements BOTH IAddAccount and IFindAccount interfaces,
 * following the same contract the Supabase implementations use.
 *
 * What is stored per account:
 *  - username (SHA-256 hashed) → used for lookup, never stored in plain text
 *  - publicKey (hex) → the Ed25519 public key, acts as the anonymous identifier
 *  - mnemonicHashes (string[]) → SHA-256 hash of each mnemonic word, used for login challenge
 */

import type { IAddAccount, AddAccount, IFindAccount, FindAccount } from '@/domain/usecases';
import { PublicKeyInUseError, UsernameInUseError } from '@/domain/errors';

interface StoredAccount {
  usernameHash: string;
  publicKey: string;
  mnemonicHashes: string[];
}

/**
 * Hash a username with SHA-256 using the Web Crypto API.
 * The server never stores the raw username — only its hash.
 * This adds a layer of privacy: even if the store is compromised,
 * the attacker cannot recover usernames.
 */
async function hashUsername(username: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(username.trim().toLowerCase());
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class InMemoryAccountStore implements IAddAccount, IFindAccount {
  // In-memory store keyed by username hash
  private accounts = new Map<string, StoredAccount>();

  async add(params: AddAccount.Params): Promise<AddAccount.Model> {
    // Check for duplicate public key
    for (const account of this.accounts.values()) {
      if (account.publicKey === params.publicKey) {
        throw new PublicKeyInUseError();
      }
    }

    const usernameHash = await hashUsername(params.username);

    // Check for duplicate username
    if (this.accounts.has(usernameHash)) {
      throw new UsernameInUseError();
    }

    this.accounts.set(usernameHash, {
      usernameHash,
      publicKey: params.publicKey,
      mnemonicHashes: params.mnemonicHashes,
    });

    return {
      publicKey: params.publicKey,
      accessToken: params.publicKey,
    };
  }

  async findByPublicKey(publicKey: string): Promise<boolean> {
    for (const account of this.accounts.values()) {
      if (account.publicKey === publicKey) return true;
    }
    return false;
  }

  async findByUsername(username: string): Promise<FindAccount.ByUsernameResult> {
    const usernameHash = await hashUsername(username);
    const account = this.accounts.get(usernameHash);
    if (!account) return null;

    return {
      publicKey: account.publicKey,
      mnemonicHashes: account.mnemonicHashes,
    };
  }
}
