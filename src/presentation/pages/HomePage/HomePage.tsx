/**
 * HomePage — Simple authenticated landing page.
 *
 * Displays the user's public key (their anonymous identity) and provides
 * a logout button that clears the session from local storage.
 *
 * If no session exists, redirects to /login.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSession, clearSession } from '@/presentation/utils/session';
import styles from './HomePage.module.css';

export function HomePage() {
  const navigate = useNavigate();
  const publicKey = loadSession();

  useEffect(() => {
    if (!publicKey) {
      navigate('/login');
    }
  }, [publicKey, navigate]);

  if (!publicKey) {
    return null;
  }

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>Welcome Back</h2>
        <p className={styles.subtitle}>You are authenticated anonymously.</p>

        <p className={styles.label}>Your Public Key</p>
        <div className={styles.publicKey}>{publicKey}</div>

        <button className={styles.btn} onClick={handleLogout}>
          Log Out
        </button>
      </div>
    </div>
  );
}
