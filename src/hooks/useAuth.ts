import React, { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  ReactNode 
} from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../api/firebase';
import { User as AppUser } from '../types/models';
import { UserService, createDefaultUser } from '../services/UserService';

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
    // Subscribe to auth state changes from Firebase
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setLoading(true); // Maintain loading while fetching firestore doc
        try {
          const firestoreUser = await UserService.getUserDocument(firebaseUser.uid);
          
          if (firestoreUser) {
            setUser(firestoreUser);
          } else {
            const newUser = createDefaultUser(firebaseUser.uid, firebaseUser.email || '');
            await UserService.createUserDocument(newUser);
            setUser(newUser);
          }
        } catch (error) {
          setUser(null);
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
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