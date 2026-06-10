import React, { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  ReactNode 
} from 'react';
import { supabase } from '../api/supabase';
import { User as AppUser } from '../types/models';
import { UserService, createDefaultUser } from '../services/UserService';
import {CrashLogger} from "../services/LoggingService";

// 1. Define the Shape of the Context
interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

// 2. Create the Context (The Variable)
// We initialize it with default values to avoid null checks later.
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

// 3. Create the Provider Component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Resolve the app-level profile for a Supabase auth user.
    const resolveProfile = async (authUser: { id: string; email?: string } | null) => {
      if (!authUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        let profile = await UserService.getUserDocument(authUser.id);
        if (!profile) {
          // The handle_new_user trigger normally creates the row; this is a
          // fallback for any pre-trigger/legacy account.
          const newUser = createDefaultUser(authUser.id, authUser.email || '');
          await UserService.createUserDocument(newUser);
          profile = newUser;
        }
        setUser(profile);
      } catch (error) {
        CrashLogger.error(error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    // Prime from any persisted session, then subscribe to changes.
    supabase.auth.getSession().then(({ data }) => {
      resolveProfile(data.session?.user ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveProfile(session?.user ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // Logout failed
    }
  };

  // 4. Return the Context Provider
  return React.createElement(
    AuthContext.Provider,
    { value: { user, loading, logout } },
    children
  );
};

// 5. Create the Custom Hook for easy access
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};