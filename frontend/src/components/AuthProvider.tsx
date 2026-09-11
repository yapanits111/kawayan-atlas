"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, clearToken, getToken, setToken, type AuthUser } from "@/lib/api";

interface AuthState {
  user: AuthUser | null;
  loading: boolean; // true until the initial token check resolves
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  logout: () => void;
  logoutEverywhere: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, if a token is stored, resolve it to the current user (or drop it if stale).
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    setToken(res.access_token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await api.register(email, password);
    setToken(res.access_token);
    setUser(res.user);
  }, []);

  // Changing the password rotates the token (the server revokes the old one), so store
  // the fresh token to keep this session signed in.
  const changePassword = useCallback(async (current: string, next: string) => {
    const res = await api.changePassword(current, next);
    setToken(res.access_token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  // Revoke every outstanding token server-side, then drop this session locally.
  const logoutEverywhere = useCallback(async () => {
    try {
      await api.logoutAll();
    } finally {
      clearToken();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, changePassword, logout, logoutEverywhere }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
