/**
 * SignupPage — Anonymous account registration flow.
 *
 * Steps:
 *  1. Generate a 12-word BIP-39 mnemonic (the user's only secret).
 *  2. User copies the mnemonic and picks a username.
 *  3. User confirms 3 randomly selected words to prove they saved the mnemonic.
 *  4. Each mnemonic word is SHA-256 hashed and sent to the server alongside
 *     the Ed25519 public key. No plaintext secrets leave the browser.
 */

import { useState, useContext, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AddAccountContext, CryptoKeyPairContext } from '@/presentation/hooks';
import { PublicKeyInUseError, UsernameInUseError } from '@/domain/errors';
import { saveSession } from '@/presentation/utils/session';
import { hashMnemonicWords } from '@/presentation/utils/hashWord';
import styles from './SignupPage.module.css';

type Step = 'generate' | 'confirm' | 'done';

const CONFIRM_WORD_COUNT = 3;

/**
 * Pick `count` unique random indices from [0, max).
 * Used to select which mnemonic words the user must confirm.
 */
function pickRandomIndices(count: number, max: number): number[] {
  const indices = new Set<number>();
  while (indices.size < count) {
    indices.add(Math.floor(Math.random() * max));
  }
  return Array.from(indices).sort((a, b) => a - b);
}

export function SignupPage() {
  const navigate = useNavigate();
  const addAccount = useContext(AddAccountContext);
  const crypto = useContext(CryptoKeyPairContext);

  const [step, setStep] = useState<Step>('generate');
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [publicKey, setPublicKey] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmIndices, setConfirmIndices] = useState<number[]>([]);
  const [confirmValues, setConfirmValues] = useState<string[]>(Array(CONFIRM_WORD_COUNT).fill(''));
  const [confirmErrors, setConfirmErrors] = useState<boolean[]>(Array(CONFIRM_WORD_COUNT).fill(false));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Generate a new mnemonic and derive the Ed25519 key pair from it
  const handleGenerate = useCallback(async () => {
    if (!crypto) return;
    const words = crypto.generateMnemonic();
    const wordList = words.split(' ');
    setMnemonic(wordList);
    const kp = await crypto.deriveKeyPair(words);
    setPublicKey(kp.publicKey);
    setCopied(false);
    setConfirmValues(Array(CONFIRM_WORD_COUNT).fill(''));
    setConfirmErrors(Array(CONFIRM_WORD_COUNT).fill(false));
    setError('');
  }, [crypto]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(mnemonic.join(' '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [mnemonic]);

  const handleContinueToConfirm = useCallback(() => {
    setConfirmIndices(pickRandomIndices(CONFIRM_WORD_COUNT, mnemonic.length));
    setConfirmValues(Array(CONFIRM_WORD_COUNT).fill(''));
    setConfirmErrors(Array(CONFIRM_WORD_COUNT).fill(false));
    setStep('confirm');
  }, [mnemonic.length]);

  const handleConfirmWordChange = useCallback((idx: number, value: string) => {
    setConfirmValues((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
    setConfirmErrors((prev) => {
      const next = [...prev];
      next[idx] = false;
      return next;
    });
  }, []);

  const allConfirmFilled = confirmValues.every((v) => v.trim().length > 0);

  /**
   * Confirm the mnemonic words and create the account:
   *  1. Validate the user typed the correct words.
   *  2. Hash all 12 mnemonic words with SHA-256.
   *  3. Send { username, publicKey, mnemonicHashes } to the account store.
   *  4. Save the session (public key only) to local storage.
   */
  const handleConfirmAndCreate = useCallback(async () => {
    const errors = confirmIndices.map(
      (mnIdx, i) => confirmValues[i]!.trim().toLowerCase() !== mnemonic[mnIdx]?.toLowerCase()
    );
    if (errors.some(Boolean)) {
      setConfirmErrors(errors);
      return;
    }
    setConfirmErrors(Array(CONFIRM_WORD_COUNT).fill(false));
    setLoading(true);
    setError('');

    if (!username.trim()) {
      setUsernameError('Username is required');
      setLoading(false);
      return;
    }

    try {
      // Hash each mnemonic word individually with SHA-256 before sending
      const mnemonicHashes = await hashMnemonicWords(mnemonic);
      await addAccount!.add({ username: username.trim().toLowerCase(), publicKey, mnemonicHashes });
      saveSession(publicKey);
      setStep('done');
    } catch (err) {
      if (err instanceof PublicKeyInUseError) {
        setError('This public key is already registered. Try regenerating.');
      } else if (err instanceof UsernameInUseError) {
        setUsernameError('This username is already taken.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [confirmValues, confirmIndices, mnemonic, addAccount, publicKey, username]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>Create Anonymous Account</h2>
        <p className={styles.subtitle}>No email, no password — just a seed phrase.</p>

        {step === 'generate' && (
          <>
            <p className={styles.stepDesc}>
              Generate a 12-word mnemonic seed phrase. This is your only key — save it somewhere safe.
            </p>

            {mnemonic.length > 0 && (
              <>
                <div className={styles.mnemonicGrid}>
                  {mnemonic.map((word, i) => (
                    <div key={i} className={styles.mnemonicWord}>
                      <span className={styles.wordIndex}>{i + 1}.</span>
                      {word}
                    </div>
                  ))}
                </div>

                <div className={styles.warning}>
                  ⚠ Write down these words and keep them safe. They cannot be recovered.
                </div>
              </>
            )}

            <div className={styles.actions}>
              {mnemonic.length === 0 ? (
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={handleGenerate}
                  data-testid="generate-btn"
                >
                  Generate Seed Phrase
                </button>
              ) : (
                <>
                  <button
                    className={`${styles.btn} ${styles.btnOutline}`}
                    onClick={handleCopy}
                    data-testid="copy-btn"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                  <button
                    className={`${styles.btn} ${styles.btnOutline}`}
                    onClick={handleGenerate}
                    data-testid="regenerate-btn"
                  >
                    Regenerate
                  </button>
                  <button
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={handleContinueToConfirm}
                    data-testid="continue-btn"
                  >
                    Continue
                  </button>
                </>
              )}
            </div>

            <p className={styles.footerLink}>
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </>
        )}

        {step === 'confirm' && (
          <form onSubmit={(e) => { e.preventDefault(); handleConfirmAndCreate(); }}>
            <h3 className={styles.stepTitle}>Confirm Your Seed</h3>
            <p className={styles.stepDesc}>
              Enter a username and confirm the words below to prove you saved your seed phrase.
            </p>

            <div className={styles.usernameField}>
              <label className={styles.fieldLabel}>Username</label>
              <input
                className={`${styles.input} ${usernameError ? styles.inputError : ''}`}
                placeholder="Choose a username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setUsernameError(''); }}
                data-testid="signup-username"
              />
              {usernameError && <p className={styles.helperText}>{usernameError}</p>}
            </div>

            <div className={styles.confirmGrid}>
              {confirmIndices.map((mnIdx, i) => (
                <div key={mnIdx}>
                  <label className={styles.fieldLabel}>Word #{mnIdx + 1}</label>
                  <input
                    className={`${styles.input} ${confirmErrors[i] ? styles.inputError : ''}`}
                    value={confirmValues[i]}
                    onChange={(e) => handleConfirmWordChange(i, e.target.value)}
                    placeholder={`Enter word #${mnIdx + 1}`}
                    data-testid={`confirm-input-${i}`}
                  />
                </div>
              ))}
            </div>

            <div className={styles.actions}>
              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={loading || !allConfirmFilled}
                data-testid="confirm-btn"
              >
                {loading ? 'Creating…' : 'Create Account'}
              </button>
            </div>

            {error && <p className={styles.errorText}>{error}</p>}
          </form>
        )}

        {step === 'done' && (
          <div className={styles.successContainer}>
            <p className={styles.successIcon}>✓</p>
            <h3 className={styles.stepTitle}>Account Created!</h3>
            <p className={styles.stepDesc}>
              Your anonymous account is ready. Remember your seed phrase — it's the only way to log back in.
            </p>
            <div className={styles.actions}>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => navigate('/')}
                data-testid="go-home-btn"
              >
                Go to Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
