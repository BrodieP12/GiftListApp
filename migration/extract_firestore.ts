import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Handle potential typo in naming based on user input
const DEV_KEY_PATH = path.resolve(__dirname, '../serviceAccountKey.json');
const TYPO_KEY_PATH = path.resolve(__dirname, '../serviceAccounKey.json');
const keyPath = fs.existsSync(DEV_KEY_PATH) ? DEV_KEY_PATH : TYPO_KEY_PATH;

if (!fs.existsSync(keyPath)) {
  console.error(`Missing service account key. Looked at: ${keyPath}`);
  process.exit(1);
}

const serviceAccount = require(keyPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/**
 * Extracts ALL Firestore collections needed for the Supabase migration:
 *   lists, lists/{id}/items, claims, users, feedback.
 * Output is a single JSON payload consumed by transform.ts.
 */
async function extractData() {
  console.log('Starting Firestore Data Extraction...');

  const extractedLists: any[] = [];
  const extractedItems: any[] = [];

  const snapshotLists = await db.collection('lists').get();
  for (const listDoc of snapshotLists.docs) {
    extractedLists.push({ id: listDoc.id, ...listDoc.data() });

    const itemsSnapshot = await db.collection(`lists/${listDoc.id}/items`).get();
    for (const itemDoc of itemsSnapshot.docs) {
      extractedItems.push({ id: itemDoc.id, list_id: listDoc.id, ...itemDoc.data() });
    }
  }

  // claims/{itemId}
  const claimsSnapshot = await db.collection('claims').get();
  const extractedClaims = claimsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  // users/{uid}
  const usersSnapshot = await db.collection('users').get();
  const extractedUsers = usersSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  // feedback/{id}
  const feedbackSnapshot = await db.collection('feedback').get();
  const extractedFeedback = feedbackSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  const payload = {
    users: extractedUsers,
    lists: extractedLists,
    items: extractedItems,
    claims: extractedClaims,
    feedback: extractedFeedback,
  };

  const outputPath = path.resolve(__dirname, 'extracted_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

  console.log('Extraction Complete!');
  console.log(`  users:    ${extractedUsers.length}`);
  console.log(`  lists:    ${extractedLists.length}`);
  console.log(`  items:    ${extractedItems.length}`);
  console.log(`  claims:   ${extractedClaims.length}`);
  console.log(`  feedback: ${extractedFeedback.length}`);
  console.log(`Saved output to ${outputPath}`);
}

extractData().catch(console.error);
