/**
 * SHA-256 hashing utilities for mnemonic words.
 *
 * During registration, each word of the 12-word mnemonic is individually
 * hashed with SHA-256 and stored on the server. This way:
 *  - The server never sees the actual mnemonic words.
 *  - During login, the server can challenge the user to prove knowledge
 *    of specific words by comparing hashes, without revealing the full mnemonic.
 *
 * Uses the browser's built-in Web Crypto API (crypto.subtle.digest) —
 * no extra dependencies needed for hashing.
 */

export async function hashWord(word: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(word.trim().toLowerCase());
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashMnemonicWords(words: string[]): Promise<string[]> {
  return Promise.all(words.map(hashWord));
}
