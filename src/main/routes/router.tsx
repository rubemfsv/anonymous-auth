/**
 * Router — Composition root for the anonymous-auth app.
 *
 * This is where all dependencies are created (via factories) and injected
 * into the React component tree through Context providers, following the
 * same pattern used in the Satlance project.
 *
 * The presentation layer never imports infrastructure directly — it only
 * consumes interfaces via React Context.
 */

import { useMemo, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
  AddAccountContext,
  CryptoKeyPairContext,
  FindAccountContext,
} from '@/presentation/hooks';
import { initSessionStorage } from '@/presentation/utils/session';
import { makeEd25519CryptoKeyPair } from '@/main/factories/makeEd25519CryptoKeyPair';
import { makeInMemoryAddAccount, makeInMemoryFindAccount } from '@/main/factories/makeInMemoryAccountStore';
import { makeLocalStorageAdapter } from '@/main/factories/makeLocalStorageAdapter';
import { SignupPage } from '@/presentation/pages/SignupPage/SignupPage';
import { LoginPage } from '@/presentation/pages/LoginPage/LoginPage';
import { HomePage } from '@/presentation/pages/HomePage/HomePage';

export function AppRouter() {
  const cryptoKeyPair = useMemo(() => makeEd25519CryptoKeyPair(), []);
  const addAccount = useMemo(() => makeInMemoryAddAccount(), []);
  const findAccount = useMemo(() => makeInMemoryFindAccount(), []);

  // Initialize the session storage adapter once on mount
  useEffect(() => {
    initSessionStorage(makeLocalStorageAdapter());
  }, []);

  return (
    <AddAccountContext.Provider value={addAccount}>
      <CryptoKeyPairContext.Provider value={cryptoKeyPair}>
        <FindAccountContext.Provider value={findAccount}>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </FindAccountContext.Provider>
      </CryptoKeyPairContext.Provider>
    </AddAccountContext.Provider>
  );
}
