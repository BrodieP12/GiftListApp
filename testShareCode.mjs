import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDWxeuR5lvWg4mSGd17OYWLRNLXbr1y64s",
  authDomain: "giftlistapp-557ce.firebaseapp.com",
  databaseURL: "https://giftlistapp-557ce-default-rtdb.firebaseio.com",
  projectId: "giftlistapp-557ce",
  storageBucket: "giftlistapp-557ce.firebasestorage.app",
  messagingSenderId: "616461662273",
  appId: "1:616461662273:web:b3d70b9bea6bdd005c6ec0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Simulated createShareCode method from ListService.ts
async function createShareCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const codeLength = 7;
  let result = '';
  for (let i = 0; i < codeLength; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }
  return result;
}

async function testShareCodeQuery() {
  console.log("Generating a new share code...");
  const newCode = await createShareCode();
  console.log(`Generated Code: ${newCode}\n`);

  console.log("--- TEST 1: Fetching all share codes ---");
  // Query that fetches ALL lists to extract their share codes
  const listsSnapshot = await getDocs(collection(db, 'lists'));
  
  const allExistingCodes = listsSnapshot.docs
    .map(doc => doc.data().shareCode)
    .filter(code => code !== undefined); // Only keep defined codes
    
  console.log(`Total lists in DB: ${listsSnapshot.docs.length}`);
  console.log(`Lists with share codes: ${allExistingCodes.length}`);
  if (allExistingCodes.length > 0) {
    console.log(`Existing Codes: ${allExistingCodes.join(', ')}`);
  }

  // Test against the newly generated code
  const isUniqueGlobally = !allExistingCodes.includes(newCode);
  if (isUniqueGlobally) {
<<<<<<< HEAD
    console.log(`SUCCESS: The new code '${newCode}' is unique among all existing codes!`);
  } else {
    console.log(`COLLISION: The new code '${newCode}' matches an existing code!`);
=======
    console.log(`✅ SUCCESS: The new code '${newCode}' is unique among all existing codes!`);
  } else {
    console.log(`❌ COLLISION: The new code '${newCode}' matches an existing code!`);
>>>>>>> 29f894d3b199566e035a47023f4e8d7539dfe792
  }


  console.log("\n--- TEST 2: Direct Firestore Query ---");
  // A more efficient way to test uniqueness is querying directly for the new code
  console.log(`Running query: getDocs(query(collection(db, 'lists'), where('shareCode', '==', '${newCode}')))`);
  
  const q = query(collection(db, 'lists'), where('shareCode', '==', newCode));
  const specificSnapshot = await getDocs(q);

  if (specificSnapshot.empty) {
<<<<<<< HEAD
    console.log(`SUCCESS: Direct query confirmed no list exists with code '${newCode}'.`);
  } else {
    console.log(`COLLISION: Direct query found a list with code '${newCode}'.`);
=======
    console.log(`✅ SUCCESS: Direct query confirmed no list exists with code '${newCode}'.`);
  } else {
    console.log(`❌ COLLISION: Direct query found a list with code '${newCode}'.`);
>>>>>>> 29f894d3b199566e035a47023f4e8d7539dfe792
  }

  process.exit(0);
}

testShareCodeQuery().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
