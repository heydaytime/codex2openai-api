"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { apiGet } from "./api";

const IS_DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  provider: string | null;
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (idToken: string) => {
    try {
      const data = await apiGet("/api/auth/me", idToken);
      if (data.ok) {
        setUser(data.user);
        setToken(idToken);
        return true;
      }
      setUser(null);
      return false;
    } catch {
      setUser(null);
      return false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }

    if (IS_DEV_MODE) {
      const saved = sessionStorage.getItem("linkqt-dev-token");
      if (saved) {
        fetchProfile(saved).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
      return;
    }

    let unsubscribe: (() => void) | undefined;

    import("./firebase").then(({ onAuthChange }) => {
      unsubscribe = onAuthChange(async (firebaseUser) => {
        if (firebaseUser) {
          const idToken = await firebaseUser.getIdToken();
          setToken(idToken);
          await fetchProfile(idToken);
        } else {
          setUser(null);
          setToken(null);
        }
        setLoading(false);
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    if (IS_DEV_MODE) {
      sessionStorage.removeItem("linkqt-dev-token");
    } else {
      const { signOut: fbSignOut } = await import("./firebase");
      await fbSignOut();
    }
    setUser(null);
    setToken(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (IS_DEV_MODE) {
      const devToken = "dev-token";
      sessionStorage.setItem("linkqt-dev-token", devToken);
      await fetchProfile(devToken);
      return;
    }

    const { getIdToken } = await import("./firebase");
    const idToken = await getIdToken();
    if (idToken) {
      setToken(idToken);
      await fetchProfile(idToken);
    }
  }, [fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, token, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
