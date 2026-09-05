import { Timestamp } from "firebase/firestore";

/**
 * COMPREHENSIVE USER PROFILE
 * This is the full profile shape created during registration.
 */
export interface User {
  uid: string;
  email: string;
  displayName: string;
  givenName: string;
  familyName: string;
  photoURL: string | null;
  birthday: Date | null | Timestamp; // Firestore returns Timestamp, code often sets Date
  isPremium: boolean;
  createdAt: Date | null | Timestamp;

  minorProtection: {
    isMinor: boolean;
    parentEmail: string;
  };

  legalAcceptance: {
    termsAccepted: boolean;
    privacyAccepted: boolean;
    acceptanceDate: Date | null | Timestamp;
    isEUUser: boolean;
    gdprApplies: boolean;
    acceptedDataProcessing: boolean;
  };
}

export interface GiftList {
  id: string;
  ownerId: string;
  title: string;
  isPrivate: boolean;
  shareCode?: string;
  allowedUsers: string[]; // Array of User UIDs
  clientCreatedAt: Timestamp;
  serverReceivedAt: Timestamp;
  updatedAt?: Timestamp | null;
}

export interface GiftItem {
  id: string;
  listId: string;
  name: string;
  description?: string; 
  price?: number;
  imageUri?: string;
  url?: string;           // External retailer URL
  clientCreatedAt: Timestamp;
  serverReceivedAt: Timestamp;
  updatedAt?: Timestamp | null;
  substitutions: boolean;
}

/**
 * CLAIMS (The Surprise Logic)
 * We separate this from GiftItem so we can use security rules 
 * to hide it from the list owner.
 */
export interface ItemClaim {
  itemId: string;
  item: GiftItem;
  claimedBy: string;      // User UID of the guest who bought it
  listOwnerId: string;    // Needed for Security Rules to block the owner
  claimedAt: Timestamp;
  onToggleClaim: (itemId: string, claimedBy: string | null) => void;
}

/**
 * UI MODEL
 * This is what the frontend actually uses. 
 * It merges the Item data with the Claim data (if visible).
 */
export interface GiftItemUI extends GiftItem {
  // If null/undefined, the item is available.
  // If set, it shows who claimed it (unless you are the owner, then this is always undefined).
  claimStatus?: ItemClaim | null; 
}

export interface Feedback {
  id: string;
  userId: string;
  userEmail: string;
  text: string;
  type: 'bug' | 'feature' | 'general';
  createdAt: Timestamp;
}

export interface Friend {

}
