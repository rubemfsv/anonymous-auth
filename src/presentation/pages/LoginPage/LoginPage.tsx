/**
 * LoginPage — Anonymous login flow using mnemonic word challenge.
 *
 * Steps:
 *  1. User enters their username.
 *  2. The server returns the stored SHA-256 hashes of each mnemonic word.
 *  3. The client picks 3 random word positions and asks the user to type them.
 *  4. Each typed word is hashed with SHA-256 and compared against the stored hash.
 *  5. If all 3 match → the user is authenticated. No password ever leaves the browser.
 *
 * This is a zero-knowledge-style challenge: the server only sees hashes,
 * and only a subset is verified each time, so the full mnemonic is never
 * transmitted or exposed in a single request.
 */

import { useState, useContext, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FindAccountContext } from '@/presentation/hooks';
import { hashWord } from '@/presentation/utils/hashWord';
import type { FindAccount } from '@/domain/usecases';
import { saveSession } from '@/presentation/utils/session';
import styles from './LoginPage.module.css';

const CHALLENGE_WORD_COUNT = 3;

/**
 * Pick `count` unique random indices from [0, max).
 * Used to randomly select which mnemonic words the user must prove.
 */
function pickRandomIndices(count: number, max: number): number[] {
  const indices = new Set<number>();
  while (indices.size < count) {
    indices.add(Math.floor(Math.random() * max));
  }
  return Array.from(indices).sort((a, b) => a - b);
}

type LoginStep = 'username' | 'words';

export function LoginPage() {
  const navigate = useNavigate();
  const findAccount = useContext(FindAccountContext);

  const [step, setStep] = useState<LoginStep>('username');
  const [username, setUsername] = useState('');
  const [userData, setUserData] = useState<FindAccount.ByUsernameResult>(null);
  const [challengeIndices, setChallengeIndices] = useState<number[]>([]);
  const [words, setWords] = useState<string[]>(Array(CHALLENGE_WORD_COUNT).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Look up the username and retrieve the mnemonic hashes
  const handleLookupUsername = useCallback(async () => {
    if (!findAccount || !username.trim()) return;
    setLoading(true);
    setError('');

    try {
      const result = await findAccount.findByUsername(username.trim().toLowerCase());
      if (!result) {
        setError('Account not found. Check your username.');
        return;
      }
      setUserData(result);
      // Pick 3 random word positions for the challenge
      const indices = pickRandomIndices(CHALLENGE_WORD_COUNT, result.mnemonicHashes.length);
      setChallengeIndices(indices);
      setWords(Array(CHALLENGE_WORD_COUNT).fill(''));
      setStep('words');
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [findAccount, username]);

  const handleWordChange = useCallback((index: number, value: string) => {
    setWords((prev) => {
      const next = [...prev];
      next[index] = value.trim().toLowerCase();
      return next;
    });
    setError('');
  }, []);

  const allFilled = words.every((w) => w.length > 0);

  /**
   * Step 2: Verify the challenged mnemonic words.
   * Hash each typed word with SHA-256 and compare against the stored hash.
   * If all match → authenticated.
   */
  const handleVerifyWords = useCallback(async () => {
    if (!userData || !allFilled) return;
    setLoading(true);
    setError('');

    try {
      const results = await Promise.all(
        challengeIndices.map(async (mnIdx, i) => {
          // Hash the user-typed word and compare to the stored hash
          const hash = await hashWord(words[i]!);
          return hash === userData.mnemonicHashes[mnIdx];
        })
      );

      if (results.every(Boolean)) {
        // All words matched — save session and redirect
        saveSession(userData.publicKey);
        navigate('/');
      } else {
        setError('One or more words are incorrect. Try again.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userData, challengeIndices, words, allFilled, navigate]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>Anonymous Login</h2>
        <p className={styles.subtitle}>Prove your identity with your seed phrase.</p>

        {step === 'username' && (
          <form onSubmit={(e) => { e.preventDefault(); handleLookupUsername(); }}>
            <div className={styles.usernameField}>
              <label className={styles.fieldLabel}>Username</label>
              <input
                className={styles.input}
                placeholder="Enter your username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                data-testid="login-username"
              />
            </div>

            <div className={styles.actions}>
              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={loading || !username.trim()}
                data-testid="login-submit-btn"
              >
                {loading ? 'Looking up…' : 'Continue'}
              </button>
            </div>
          </form>
        )}

        {step === 'words' && (
          <form onSubmit={(e) => { e.preventDefault(); handleVerifyWords(); }}>
            <div className={styles.wordsGrid}>
              {challengeIndices.map((mnIdx, i) => (
                <div key={mnIdx}>
                  <label className={styles.fieldLabel}>Word #{mnIdx + 1}</label>
                  <input
                    className={styles.input}
                    placeholder={`Enter word #${mnIdx + 1}`}
                    value={words[i]}
                    onChange={(e) => handleWordChange(i, e.target.value)}
                    data-testid={`login-word-${i}`}
                  />
                </div>
              ))}
            </div>

            <div className={styles.actions}>
              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={loading || !allFilled}
                data-testid="login-verify-btn"
              >
                {loading ? 'Verifying…' : 'Log In'}
              </button>
            </div>
          </form>
        )}

        {error && <p className={styles.errorText}>{error}</p>}

        <p className={styles.footerLink}>
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
