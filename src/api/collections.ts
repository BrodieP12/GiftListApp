import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { db } from './firebase';
import { GiftList, GiftItem, ItemClaim, User } from '../types/models';

/**
 * Type-Safe Collection References
 * These helpers ensure that all Firestore operations are strongly typed.
 */

// 1. Root Collections
export const listsRef = db.collection('lists') as FirebaseFirestoreTypes.CollectionReference<GiftList>;
export const claimsRef = db.collection('claims') as FirebaseFirestoreTypes.CollectionReference<ItemClaim>;
export const usersRef = db.collection('users') as FirebaseFirestoreTypes.CollectionReference<User>;

// 2. Sub-Collections (Function required because the path is dynamic)
export const getItemsRef = (listId: string) => {
  return db.collection(`lists/${listId}/items`) as FirebaseFirestoreTypes.CollectionReference<GiftItem>;
};

// 3. Grouping for easier imports (Optional)
export const collections = {
  lists: listsRef,
  claims: claimsRef,
  users: usersRef,
  items: getItemsRef,
};