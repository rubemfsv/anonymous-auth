# Anonymous Auth

A fully anonymous authentication system that requires **no email, no password, and no personal data**. Users authenticate using a cryptographic seed phrase (BIP-39 mnemonic) and an Ed25519 key pair — the same technology that secures cryptocurrency wallets.

Extracted logic from the [Satlance](https://satlance.com/)'s auth, this repository isolates the login and registration logic into a standalone demo with **no database dependency**.

---

## Why Anonymous Authentication?

Traditional auth systems collect emails, phone numbers, or social accounts — creating honeypots of personal data that can be breached, sold, or subpoenaed. Anonymous auth flips this model:

| Traditional Auth | Anonymous Auth |
|---|---|
| Email + password stored on server | Only a **public key** stored on server |
| Password resets via email | Recovery via **seed phrase** (user-held) |
| Server knows your identity | Server knows **nothing** about you |
| Data breaches expose PII | Breach exposes only public keys (useless) |

### Key benefits

- **Privacy by design** — No personally identifiable information is ever collected or stored.
- **Zero-knowledge login** — The server verifies knowledge of the seed phrase through hash comparison, without ever seeing the actual words.
- **Self-sovereign identity** — The user controls their own key pair. No "forgot password" emails, no account lockouts by an admin.
- **Breach-resistant** — Even if the server database is fully compromised, attackers get only public keys and SHA-256 hashes — both computationally useless for impersonation.

---

## Architecture

This project follows **Clean Architecture** with strict layer separation, mirroring [Clean React App](https://github.com/rubemfsv/clean-react-app) project structure:

```
src/
├── domain/          # Business rules: models, errors, use case interfaces
│   ├── errors/      # PublicKeyInUseError, UsernameInUseError, UnexpectedError
│   ├── models/      # AccountModel
│   └── usecases/    # IAddAccount, IFindAccount (interfaces only)
│
├── data/            # Data layer: protocols (abstractions)
│   └── protocols/
│       ├── crypto/  # ICryptoKeyPair interface
│       └── cache/   # IGetStorage, ISetStorage interfaces
│
├── infra/           # Infrastructure: concrete implementations
│   ├── crypto/      # Ed25519CryptoKeyPair (BIP-39 + Ed25519)
│   ├── store/       # InMemoryAccountStore (replaces Supabase for demo)
│   └── cache/       # LocalStorageAdapter
│
├── presentation/    # UI: React pages, hooks, utilities
│   ├── pages/       # SignupPage, LoginPage, HomePage
│   ├── hooks/       # React Context definitions
│   ├── utils/       # hashWord, session management
│   └── protocols/   # IValidation interface
│
└── main/            # Composition root: wires everything together
    ├── factories/   # Factory functions for dependency injection
    └── routes/      # React Router + Context providers
```

**The presentation layer never imports infrastructure directly** — it only consumes interfaces via React Context, injected at the `main/` composition root.

---

## How It Works

### 1. Registration (Signup)

```
User clicks "Generate" → BIP-39 mnemonic (12 words) is created client-side
                        → Ed25519 key pair is derived from the mnemonic
                        → User copies and saves the mnemonic
                        → Each word is SHA-256 hashed individually
                        → { username, publicKey, mnemonicHashes[] } sent to server
```

#### Generating the mnemonic (BIP-39)

BIP-39 is a standard for generating human-readable seed phrases from random entropy. It maps 128 bits of randomness to 12 words from a fixed 2048-word English dictionary.

```typescript
// src/infra/crypto/Ed25519CryptoKeyPair.ts

import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

// Generate a 12-word mnemonic from 128 bits of cryptographic randomness.
// Example: "abandon ability able about above absent absorb abstract absurd abuse access accident"
generateMnemonic(): string {
  return generateMnemonic(wordlist, 128);
}
```

#### Deriving the Ed25519 key pair

Ed25519 is an elliptic-curve signature scheme that produces 32-byte public keys and 64-byte signatures. The public key becomes the user's anonymous identity.

```typescript
// src/infra/crypto/Ed25519CryptoKeyPair.ts

import * as ed from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';

async deriveKeyPair(mnemonic: string): Promise<KeyPairResult> {
  // 1. Convert the mnemonic to a 64-byte seed (BIP-39 standard)
  const seed = mnemonicToSeedSync(mnemonic);

  // 2. HMAC-SHA-256 key derivation with a domain-separation tag.
  //    This ensures the same seed produces different keys for different apps.
  const derived = hmac(sha256, new TextEncoder().encode('anonymous-auth-ed25519'), seed);

  // 3. First 32 bytes → Ed25519 private key
  const privateKey = derived.slice(0, 32);

  // 4. Compute the corresponding 32-byte public key
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  return {
    publicKey: bytesToHex(publicKey),   // stored on server as the user's ID
    privateKey: bytesToHex(privateKey), // NEVER leaves the browser
  };
}
```

#### Hashing mnemonic words (SHA-256)

Before sending to the server, each mnemonic word is individually hashed using SHA-256 via the browser's Web Crypto API. The server stores only these hashes — never the raw words.

```typescript
// src/presentation/utils/hashWord.ts

export async function hashWord(word: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(word.trim().toLowerCase());
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Hash all 12 words in parallel
export async function hashMnemonicWords(words: string[]): Promise<string[]> {
  return Promise.all(words.map(hashWord));
}
```

#### What the server stores after registration

```json
{
  "username": "a1b2c3d4...",
  "publicKey": "ed25519-public-key-hex",
  "mnemonicHashes": [
    "e3b0c442...",
    "d7a8fbb3...",
    "..."
  ]
}
```

No plaintext username. No plaintext mnemonic words. No email. No password.

---

### 2. Login (Challenge-Response)

```
User enters username → Server returns { publicKey, mnemonicHashes[] }
                     → Client picks 3 random word positions
                     → User types those 3 words
                     → Each word is SHA-256 hashed client-side
                     → Hashes compared against stored hashes
                     → All match? → Authenticated ✓
```

This is a **zero-knowledge-style challenge**: only 3 out of 12 words are verified per login, the full mnemonic is never transmitted, and the server only ever sees hashes.

```typescript
// src/presentation/pages/LoginPage/LoginPage.tsx

// 1. Pick 3 random positions from the 12-word mnemonic
const indices = pickRandomIndices(3, result.mnemonicHashes.length);

// 2. For each challenged word, hash the user's input and compare
const results = await Promise.all(
  challengeIndices.map(async (mnIdx, i) => {
    const hash = await hashWord(words[i]!);        // SHA-256 hash of typed word
    return hash === userData.mnemonicHashes[mnIdx]; // compare to stored hash
  })
);

// 3. All 3 match → user is authenticated
if (results.every(Boolean)) {
  saveSession(userData.publicKey);
  navigate('/');
}
```

---

### 3. Session Management

The session stores only the public key and an expiration timestamp — no personal data whatsoever. The storage backend is injected via the `initSessionStorage()` function, keeping session logic decoupled from `localStorage`.

```typescript
// src/presentation/utils/session.ts

const SESSION_DURATION_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

interface SessionData {
  publicKey: string;
  expiresAt: number;
}

export function saveSession(publicKey: string): void {
  const session: SessionData = {
    publicKey,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };
  getStorage().set(SESSION_KEY, session);
}
```

---

## Cryptographic Libraries Used

| Library | Purpose | Why this one? |
|---|---|---|
| [`@scure/bip39`](https://github.com/paulmillr/scure-bip39) | Mnemonic generation | Audited, zero-dependency BIP-39 implementation |
| [`@noble/ed25519`](https://github.com/paulmillr/noble-ed25519) | Key pair + signatures | Audited, fast, pure-JS Ed25519 |
| [`@noble/hashes`](https://github.com/paulmillr/noble-hashes) | SHA-256, SHA-512, HMAC | Audited, used for key derivation and internal Ed25519 ops |
| Web Crypto API | SHA-256 word hashing | Built into every modern browser, no extra dependency |

All `@noble` and `@scure` libraries are authored by [Paul Miller](https://paulmillr.com/) and have undergone independent security audits.

---

## Running

```bash
npm install
npm run dev
```

1. Open `http://localhost:3000`
2. You'll be redirected to `/login`
3. Click **Sign up** → generate a seed phrase → confirm 3 words → done
4. Log out → log back in by entering your username and 3 challenged words

> **Note:** This demo uses an in-memory store — accounts are lost on page refresh. Replace `InMemoryAccountStore` with a real database adapter (Supabase, Postgres, etc.) for production use.

---

## Dependency Injection Flow

```
main/factories/          →  creates concrete instances
main/routes/router.tsx   →  injects them via React Context
presentation/pages/      →  consumes via useContext(...)
```

The presentation layer only depends on **interfaces** defined in `domain/` and `data/protocols/`. Swapping the in-memory store for a real database requires changing only the factory — zero changes to the UI or domain logic.

---

## License

MIT
