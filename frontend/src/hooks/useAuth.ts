import { useContext } from 'react';

import { AuthContext } from '@/context/AuthContext';
import type { AuthContextValue } from '@/context/AuthContext';

/** Throws when used outside `AuthProvider` — a wiring bug, not a runtime state. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return context;
}
