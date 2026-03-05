import { collection, CollectionReference, DocumentData } from 'firebase/firestore';
import { db } from './firebase';
import { GiftList, GiftItem, ItemClaim, User } from '../types/models';

/**
 * Type-Safe Collection References
 * These helpers ensure that all Firestore operations are strongly typed.
 */

// 1. Root Collections
export const listsRef = collection(db, 'lists') as CollectionReference<GiftList>;
export const claimsRef = collection(db, 'claims') as CollectionReference<ItemClaim>;
export const usersRef = collection(db, 'users') as CollectionReference<User>;

// 2. Sub-Collections (Function required because the path is dynamic)
export const getItemsRef = (listId: string) => {
  return collection(db, `lists/${listId}/items`) as CollectionReference<GiftItem>;
};

// 3. Grouping for easier imports (Optional)
export const collections = {
  lists: listsRef,
  claims: claimsRef,
  users: usersRef,
  items: getItemsRef,
};