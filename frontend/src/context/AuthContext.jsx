import { createContext, useContext, useState, useCallback } from 'react';
import { getToken, setToken } from '../api/client.js';
import * as API from '../api/endpoints.js';

const AuthContext = createContext(null);

const USER_KEY = 'vc_user';

export function AuthProvider({ children }) {
  const [token, setTok] = useState(() => getToken());
  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem(USER_KEY) || null;
    } catch {
      return null;
    }
  });

  const signIn = useCallback(async (user, pass) => {
    // POST /api/login -> { token, token_type, expires_in, username }
    const res = await API.login(user, pass);
    setToken(res.token);
    setTok(res.token);
    setUsername(res.username);
    try {
      localStorage.setItem(USER_KEY, res.username);
    } catch {
      /* ignore */
    }
    return res;
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setTok(null);
    setUsername(null);
    try {
      localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <AuthContext.Provider value={{ token, username, isAuthed: !!token, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
