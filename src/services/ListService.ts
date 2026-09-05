import firestore from '@react-native-firebase/firestore';
import { db, auth } from '../api/firebase';
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

    const docRef = await db.collection('lists').add({
      ownerId, // change to auth id
      title: title.trim(),
      isPrivate: !isSharable,
      allowedUsers: [],
      shareCode,
      createdAt: firestore.FieldValue.serverTimestamp()
    });

    return {
      listId: docRef.id,
      shareCode
    };
  },

  async getOwnedLists(userId: string): Promise<GiftList[]> {
    // 1. Create the query
    // 2. Fetch the snapshot
    const snapshot = await db.collection('lists').where('ownerId', '==', userId).get();
    
    // 3. CRITICAL FIX: Map the doc.id manually
    return snapshot.docs.map(doc => {
      const data = doc.data();
      
      return {
        id: doc.id,
        ownerId: data.ownerId,
        title: data.title,
        isPrivate: data.isPrivate,
        allowedUsers: data.allowedUsers || [],
        clientCreatedAt: data.createdAt
      } as GiftList;
    });
  },

  listenToOwnedLists(userId: string, onUpdate: (lists: GiftList[]) => void, onError: (err: Error) => void) {
    return db.collection('lists').where('ownerId', '==', userId).onSnapshot((snapshot) => {
      if (!snapshot) return;
      const lists = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ownerId: data.ownerId,
          title: data.title,
          isPrivate: data.isPrivate,
          allowedUsers: data.allowedUsers || [],
          shareCode: data.shareCode,
          clientCreatedAt: data.createdAt
        } as GiftList;
      });
      onUpdate(lists);
    }, onError);
  },

  listenToOwnedListItems(userId: string, listId: string,onUpdate: (items: GiftItem[]) => void, onError: (err: Error) => void) {
    return db.collection(`lists/${listId}/items`).where('ownerId', '==', userId).onSnapshot((snapshot) => {
      if (!snapshot) return;
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          listId: listId,
          name: data.name,
          description: data.description || null,
          price: data.price || null,
          imageUri: data.imageUri || null,
          url: data.url || null,           // External retailer URL
          clientCreatedAt: data.createdAt,
          updatedAt: data.updatedAt || null,
          substitutions: data.substitutions
        } as GiftItem;
      });
      onUpdate(items);
    }, onError);
  },
  async getItems(listId: string): Promise<GiftItem[]> {
    const snapshot = await db.collection(`lists/${listId}/items`).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GiftItem));
  },

  async getSharedLists(userId: string): Promise<GiftList[]> {
    const snapshot = await db.collection('lists').where('allowedUsers', 'array-contains', userId).get();
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ownerId: data.ownerId,
            title: data.title,
            isPrivate: data.isPrivate,
            allowedUsers: data.allowedUsers || [],
            clientCreatedAt: data.createdAt
        } as GiftList;
    });
  },

  async deleteList(listId: string) {
    await db.collection('lists').doc(listId).delete();
  },

  async getList(listId: string): Promise<GiftList | null> {
    const snapshot = await db.collection('lists').doc(listId).get();
    if (!snapshot.exists) return null;
    return { id: snapshot.id, ...snapshot.data() } as GiftList;
  },

  async deleteItem(listId: string, itemId: string): Promise<void> {
    await db.collection(`lists/${listId}/items`).doc(itemId).delete();
  },

  async updateList(listId: string, list: Partial<GiftList>) {
    const user = auth.currentUser;

    if(user?.uid != list.ownerId) {
      return;
    }

    const updatingList = {
      title: list.title,
      isPrivate: list.isPrivate,
      shareCode: list.shareCode,
      allowedUsers: list.allowedUsers, // Array of User UIDs
      updatedAt: firestore.FieldValue.serverTimestamp()
    }

    await db.collection('lists').doc(listId).update({
      updatingList,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  },

  async addItem(listId: string, item: Partial<GiftItem>) {
    const user = auth.currentUser;

    if(user == null){
      return;
    }

    const sendingItem = {
      ownerId: user.uid,
      name: item.name,
      description: item.description || '',
      price: item.price || null,
      imageUri: item.imageUri || '',
      url: item.url || null,
      substitutions: item.substitutions || false,
      clientCreatedAt: Date.now(),
    }

    // We add the item to the sub-collection 'items' inside the list
    return db.collection(`lists/${listId}/items`).add({
      sendingItem,
      serverReceivedAt: firestore.FieldValue.serverTimestamp(),
    });
  },

  listenToItems(listId: string, onUpdate: (items: GiftItem[]) => void, onError: (err: Error) => void) {
    return db.collection(`lists/${listId}/items`).onSnapshot((snapshot) => {
      if (!snapshot) return;
      onUpdate(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GiftItem)));
    }, onError);
  }
};