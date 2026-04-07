import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  doc,
  deleteDoc,
  getDoc,
  updateDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../api/firebase';
import { GiftList, GiftItem } from '../types/models';
import { listsRef } from '../api/collections';

export interface CreateListResult {
  listId: string;
  shareCode: string | null;
}

export const ListService = {
  // --- LISTS ---

  async createList(
    ownerId: string,
    title: string,
    isSharable: boolean = false
  ): Promise<CreateListResult> {
    let shareCode = null;
    if (isSharable) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      shareCode = Array.from({length: 7}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    const docRef = await addDoc(collection(db, 'lists'), {
      ownerId,
      title: title.trim(),
      isPrivate: !isSharable,
      allowedUsers: [],
      shareCode,
      createdAt: serverTimestamp()
    });

    return {
      listId: docRef.id,
      shareCode
    };
  },

  async getOwnedLists(userId: string): Promise<GiftList[]> {
    // 1. Create the query
    const q = query(collection(db, 'lists'), where('ownerId', '==', userId));
    
    // 2. Fetch the snapshot
    const snapshot = await getDocs(q);
    
    // 3. CRITICAL FIX: Map the doc.id manually
    return snapshot.docs.map(doc => {
      const data = doc.data();
      
      return {
        id: doc.id,
        ownerId: data.ownerId,
        title: data.title,
        isPrivate: data.isPrivate,
        allowedUsers: data.allowedUsers || [],
        createdAt: data.createdAt
      } as GiftList;
    });
  },

  listenToOwnedLists(userId: string, onUpdate: (lists: GiftList[]) => void, onError: (err: Error) => void) {
    const q = query(collection(db, 'lists'), where('ownerId', '==', userId));
    return onSnapshot(q, (snapshot) => {
      const lists = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ownerId: data.ownerId,
          title: data.title,
          isPrivate: data.isPrivate,
          allowedUsers: data.allowedUsers || [],
          shareCode: data.shareCode,
          createdAt: data.createdAt
        } as GiftList;
      });
      onUpdate(lists);
    }, onError);
  },

  async getSharedLists(userId: string): Promise<GiftList[]> {
  const q = query(collection(db, 'lists'), where('allowedUsers', 'array-contains', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
          id: doc.id,
          ownerId: data.ownerId,
          title: data.title,
          isPrivate: data.isPrivate,
          allowedUsers: data.allowedUsers || [],
          createdAt: data.createdAt
      } as GiftList;
  });
}, 

  async deleteList(listId: string) {
    await deleteDoc(doc(db, 'lists', listId));
  },

  async getList(listId: string): Promise<GiftList | null> {
    const docRef = doc(db, 'lists', listId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as GiftList;
  },

  async updateList(listId: string, data: Partial<GiftList>) {
    const docRef = doc(db, 'lists', listId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async addItem(listId: string, item: Partial<GiftItem>) {
    // We add the item to the sub-collection 'items' inside the list
    return addDoc(collection(db, `lists/${listId}/items`), {
      ...item,
      createdAt: serverTimestamp(),
    });
  },

  async getItems(listId: string): Promise<GiftItem[]> {
    const snapshot = await getDocs(collection(db, `lists/${listId}/items`));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GiftItem));
  },

  listenToItems(listId: string, onUpdate: (items: GiftItem[]) => void, onError: (err: Error) => void) {
    const q = collection(db, `lists/${listId}/items`);
    return onSnapshot(q, (snapshot) => {
      onUpdate(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GiftItem)));
    }, onError);
  }
};