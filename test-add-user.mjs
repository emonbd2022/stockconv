import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);

async function test() {
  await setDoc(doc(db, 'users', 'test-admin-uid'), {
    uid: 'test-admin-uid',
    email: 'titaniumfact97@gmail.com',
    credits: 999999,
    isUnlimited: true,
    role: 'admin',
    createdAt: new Date()
  });
  console.log("Added admin user successfully!");
}
test().catch(console.error).finally(() => process.exit(0));
