import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { nanoid } from "nanoid";

const db = getFirestore();

/**
 * Triggered when a new list is created in Firestore.
 * If the client optimistically generated a shareCode that collided with an existing one,
 * this function will detect it and assign a new unique shareCode.
 */
export const onListCreated = onDocumentCreated("lists/{listId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    return;
  }
  
  const data = snapshot.data();
  const shareCode = data.shareCode;

  if (!shareCode) {
    return;
  }

  // Check for collision using a query. 
  // We exclude the current document ID just in case.
  const existing = await db
    .collection("lists")
    .where("shareCode", "==", shareCode)
    .where("__name__", "!=", snapshot.id)
    .limit(1)
    .get();

  // If no collision, we are good!
  if (existing.empty) {
    return;
  }

  console.warn(`Collision detected for shareCode: ${shareCode}. Generating a new one...`);

  // Collision detected! Generate a new one
  let newShareCode: string | null = null;
  const maxRetries = 50;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const candidate = nanoid(7);
    const isCandidateExisting = await db
      .collection("lists")
      .where("shareCode", "==", candidate)
      .limit(1)
      .get();

    if (isCandidateExisting.empty) {
      newShareCode = candidate;
      break;
    }
  }

  if (newShareCode) {
    console.log(`Resolved collision. New shareCode: ${newShareCode}`);
    await snapshot.ref.update({ shareCode: newShareCode });
  } else {
    console.error("Failed to generate a unique share code for list " + snapshot.id);
  }
});
