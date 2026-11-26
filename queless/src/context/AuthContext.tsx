import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import type { QueueSocketMessage } from '../types/queue';

export interface AppUserProfile {
  id: number;
  uid: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  defaultPriorityType: string;
}

interface AuthContextValue {
  firebaseUser: User | null;
  profile: AppUserProfile | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  apiFetch: <T>(url: string, options?: RequestInit) => Promise<T>;
  subscribeQueueEvents: (
    handler: (msg: QueueSocketMessage) => void
  ) => () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const listenersRef = useRef<Set<(msg: QueueSocketMessage) => void>>(new Set());

  const fetchBackendProfile = useCallback(async (user: User) => {
    try {
      const idToken = await user.getIdToken();
      tokenRef.current = idToken;
      const res = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
      }
    } catch (err) {
      console.error('Failed to sync profile:', err);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await fetchBackendProfile(user);
      } else {
        tokenRef.current = null;
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchBackendProfile]);

  // Real WebSocket connection to /ws with clean reconnect
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closedByUnmount = false;

    const connect = () => {
      if (closedByUnmount) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const parsed: QueueSocketMessage = JSON.parse(event.data);
          listenersRef.current.forEach((fn) => fn(parsed));
        } catch {
          // Ignore malformed event
        }
      };

      ws.onclose = () => {
        if (!closedByUnmount) {
          reconnectTimer = setTimeout(connect, 2500);
        }
      };
    };

    connect();

    return () => {
      closedByUnmount = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  const subscribeQueueEvents = useCallback(
    (handler: (msg: QueueSocketMessage) => void) => {
      listenersRef.current.add(handler);
      return () => {
        listenersRef.current.delete(handler);
      };
    },
    []
  );

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      if (result.user) {
        await fetchBackendProfile(result.user);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Google Sign-In failed. Please try again.';
      setAuthError(msg);
      throw err;
    }
  }, [fetchBackendProfile]);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
    tokenRef.current = null;
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (auth.currentUser) {
      await fetchBackendProfile(auth.currentUser);
    }
  }, [fetchBackendProfile]);

  const apiFetch = useCallback(
    async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
      const headers = new Headers(options.headers || {});
      if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
      }

      if (auth.currentUser) {
        const freshToken = await auth.currentUser.getIdToken();
        tokenRef.current = freshToken;
        headers.set('Authorization', `Bearer ${freshToken}`);
      } else if (tokenRef.current) {
        headers.set('Authorization', `Bearer ${tokenRef.current}`);
      }

      const res = await fetch(url, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      return data as T;
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        loading,
        authError,
        signInWithGoogle,
        signOutUser,
        refreshProfile,
        apiFetch,
        subscribeQueueEvents,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
