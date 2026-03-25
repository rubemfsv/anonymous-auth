/**
 * Ed25519CryptoKeyPair — Concrete implementation of the ICryptoKeyPair protocol.
 *
 * This class uses three cryptographic building blocks:
 *
 * 1. **BIP-39 mnemonic** (@scure/bip39)
 *    Generates a human-readable 12-word seed phrase from a cryptographically
 *    secure random source. The mnemonic acts as the user's "password" — it is
 *    the ONLY secret they need to remember. Because BIP-39 words come from a
 *    fixed 2048-word English dictionary, they are easier to write down and
 *    back up than a raw hex key.
 *
 * 2. **SHA-256 / SHA-512 / HMAC** (@noble/hashes)
 *    - SHA-512 is required internally by Ed25519 for signing.
 *    - HMAC-SHA-256 is used here as a key derivation function (KDF) to
 *      deterministically derive a 32-byte Ed25519 private key from the
 *      BIP-39 seed. The HMAC key is a domain-separation tag so the same
 *      seed could produce different keys for different applications.
 *
 * 3. **Ed25519** (@noble/ed25519)
 *    A modern elliptic-curve signature scheme. It produces compact 64-byte
 *    signatures and 32-byte public keys. The public key serves as the user's
 *    anonymous identifier — it is stored on the server, but reveals nothing
 *    about the user's real identity.
 */

import * as ed from '@noble/ed25519';
import { sha512, sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import type { ICryptoKeyPair, KeyPairResult } from '@/data/protocols/crypto';

// Ed25519 requires a synchronous SHA-512 implementation for internal use.
// We wire @noble/hashes' sha512 into the ed25519 library here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(ed.etc as any).sha512Sync = (...m: Uint8Array[]) => sha512(ed.etc.concatBytes(...m));

export class Ed25519CryptoKeyPair implements ICryptoKeyPair {
  /**
   * Generate a new 12-word BIP-39 mnemonic phrase.
   * 128 bits of entropy → 12 words from the English wordlist.
   */
  generateMnemonic(): string {
    return generateMnemonic(wordlist, 128);
  }

  /**
   * Derive a deterministic Ed25519 key pair from a mnemonic phrase.
   *
   * Steps:
   *  1. Validate the mnemonic against the BIP-39 wordlist.
   *  2. Convert the mnemonic to a 64-byte seed (BIP-39 standard).
   *  3. Use HMAC-SHA-256 with a domain tag to derive a 32-byte private key.
   *  4. Compute the matching Ed25519 public key.
   *
   * The same mnemonic always produces the same key pair (deterministic).
   */
  async deriveKeyPair(mnemonic: string): Promise<KeyPairResult> {
    if (!validateMnemonic(mnemonic, wordlist)) {
      throw new Error('Invalid mnemonic phrase');
    }
    // BIP-39 seed: 64 bytes derived from the mnemonic words
    const seed = mnemonicToSeedSync(mnemonic);
    // HMAC-SHA-256 key derivation with a domain-separation tag.
    // This ensures the same seed could produce different keys for different apps.
    const derived = hmac(sha256, new TextEncoder().encode('anonymous-auth-ed25519'), seed);
    // Take the first 32 bytes as the Ed25519 private key
    const privateKey = derived.slice(0, 32);
    // Compute the corresponding public key (32 bytes)
    const publicKey = await ed.getPublicKeyAsync(privateKey);
    return {
      publicKey: bytesToHex(publicKey),
      privateKey: bytesToHex(privateKey),
    };
  }

  /**
   * Sign a message with the Ed25519 private key.
   * Returns a 64-byte (128 hex chars) signature.
   */
  async sign(message: string, privateKey: string): Promise<string> {
    const msgBytes = new TextEncoder().encode(message);
    const sig = await ed.signAsync(msgBytes, hexToBytes(privateKey));
    return bytesToHex(sig);
  }

  /**
   * Verify an Ed25519 signature against a message and public key.
   * Returns true if the signature is valid, false otherwise.
   */
  async verify(message: string, signature: string, publicKey: string): Promise<boolean> {
    const msgBytes = new TextEncoder().encode(message);
    return ed.verifyAsync(hexToBytes(signature), msgBytes, hexToBytes(publicKey));
  }
}
