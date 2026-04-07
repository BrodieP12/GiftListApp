import { doc, getDoc, setDoc, serverTimestamp, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../api/firebase';
import { User } from '../types/models';

/**
 * Creates a default User object with sensible defaults.
 * Used during registration to build a new user document.
 */
export function createDefaultUser(uid: string, email: string): User {
// ... (trimmed for space, I'll use the full content in the tool call)
  return {
    uid,
    email,
    displayName: '',
    givenName: '',
    familyName: '',
    photoURL: null,
    birthday: null,
    isPremium: false,
    createdAt: null,
    minorProtection: {
      isMinor: false,
      parentEmail: '',
    },
    legalAcceptance: {
      termsAccepted: false,
      privacyAccepted: false,
      acceptanceDate: null,
      isEUUser: false,
      gdprApplies: false,
      acceptedDataProcessing: false,
    },
  };
}

export const UserService = {
  /**
   * Creates or overwrites a user document in Firestore.
   */
  async createUserDocument(user: User): Promise<void> {
    await setDoc(doc(db, 'users', user.uid), {
      ...user,
      createdAt: serverTimestamp(),
    });
  },

  /**
   * Fetches multiple user documents from Firestore by their UIDs.
   */
  async getUserDocuments(uids: string[]): Promise<User[]> {
    if (!uids || uids.length === 0) return [];
    
    // Fetch all in parallel
    const userPromises = uids.map(uid => this.getUserDocument(uid));
    const results = await Promise.all(userPromises);
    
    // Filter out nulls (deleted users or invalid UIDs)
    return results.filter((u): u is User => u !== null);
  },

  /**
   * Fetches a user document from Firestore by UID.
   * Returns null if no document exists.
   */
  async getUserDocument(uid: string): Promise<User | null> {
    const docRef = doc(db, 'users', uid);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    
    // Helper to convert Firestore Timestamps back to JS Date objects
    const convertDate = (val: any): Date | null => {
      if (!val) return null;
      if (val instanceof Timestamp) return val.toDate();
      if (val instanceof Date) return val;
      if (typeof val === 'object' && val.seconds !== undefined) {
        return new Timestamp(val.seconds, val.nanoseconds).toDate();
      }
      return null;
    };

    const user: User = {
      uid,
      ...data,
      birthday: convertDate(data.birthday),
      createdAt: convertDate(data.createdAt),
      legalAcceptance: {
        ...data.legalAcceptance,
        acceptanceDate: convertDate(data.legalAcceptance?.acceptanceDate),
      },
    } as User;

    return user;
  },
};
