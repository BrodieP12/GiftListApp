import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../api/firebase';
import { Feedback } from '../types/models';

export const FeedbackService = {
  /**
   * Submits user feedback to Firestore
   */
  async submitFeedback(userId: string, userEmail: string, text: string) {
    if (!text.trim()) throw new Error("Feedback cannot be empty");

    await addDoc(collection(db, 'feedback'), {
      userId,
      userEmail,
      text,
      type: 'general', // You could expand this with a dropdown later
      createdAt: serverTimestamp(),
      // Optional: Add app version or platform info here
      platform: 'mobile' 
    });
  }
};