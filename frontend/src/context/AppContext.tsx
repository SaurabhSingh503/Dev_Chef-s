import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '../types';
import { authApi } from '../services/authApi';
type AppContextValue = { 
  user: User | null; 
  theme: 'light' | 'dark'; 
  setTheme: (v: 'light' | 'dark') => void;
  signIn: (user: User, token: string) => void;
  signOut: () => Promise<void>;
  updateUser: (user: User) => void;
  loading: boolean;
};
const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const token = localStorage.getItem('manak_auth_token');
    if (token) {
      authApi.me(token).then(data => {
        setUser(data);
      }).catch(() => {
        localStorage.removeItem('manak_auth_token');
      }).finally(() => {
        setLoading(false);
      });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
    }

    const handleUnauthorized = () => {
      localStorage.removeItem('manak_auth_token');
      setUser(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const value = useMemo(() => ({
    user,
    theme,
    loading,
    setTheme,
    signIn: (newUser: User, token: string) => {
      localStorage.setItem('manak_auth_token', token);
      setUser(newUser);
    },
    updateUser: (updatedUser: User) => {
      setUser(updatedUser);
    },
    signOut: async () => {
      const token = localStorage.getItem('manak_auth_token');
      if (token) {
        await authApi.logout(token).catch(console.error);
      }
      localStorage.removeItem('manak_auth_token');
      setUser(null);
    }
  }), [user, theme, loading]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export const useApp=()=>{const value=useContext(AppContext); if(!value) throw new Error('useApp must be used within AppProvider'); return value;};
