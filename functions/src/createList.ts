import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { nanoid } from "nanoid";

const db = getFirestore();

/**
 * Callable Cloud Function: createList
 *
 * Creates a new gift list in Firestore.
 * If `isSharable` is true, generates a unique 7-char share code
 * (with collision detection via Firestore query, up to 5 retries).
 *
 * @param data.title     - Name of the list (required, non-empty string)
 * @param data.isSharable - Whether this list should be shareable
 * @returns { listId: string, shareCode: string | null }
 */
export const createList = onCall(
  { timeoutSeconds: 30 },
  async (request) => {
    // 1. Ensure the user is authenticated
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be logged in to create a list."
      );
    }

    const uid = request.auth.uid;
    const { title, isSharable } = request.data as {
      title: string;
      isSharable: boolean;
    };

    // 2. Validate input
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "A non-empty list title is required."
      );
    }

    // 3. Generate a unique share code if the list is sharable
    let shareCode: string | null = null;

    if (isSharable) {
      const maxRetries = 5;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const candidate = nanoid(7);
        const existing = await db
          .collection("lists")
          .where("shareCode", "==", candidate)
          .limit(1)
          .get();

        if (existing.empty) {
          shareCode = candidate;
          break;
        }
        // Collision — retry with a new code
      }

      if (!shareCode) {
        throw new HttpsError(
          "internal",
          "Failed to generate a unique share code. Please try again."
        );
      }
    }

    // 4. Create the list document in Firestore
    const listData: Record<string, unknown> = {
      ownerId: uid,
      title: title.trim(),
      isPrivate: !isSharable,
      allowedUsers: [],
      createdAt: FieldValue.serverTimestamp(),
    };

    // Only write shareCode if the list is sharable
    if (shareCode) {
      listData.shareCode = shareCode;
    }

    const docRef = await db.collection("lists").add(listData);

    // 5. Return the result to the client
    return {
      listId: docRef.id,
      shareCode,
    };
  }
);
