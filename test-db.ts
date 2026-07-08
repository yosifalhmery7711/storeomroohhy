import { initializeApp } from 'firebase/app';
import { initializeFirestore, getDocs, collection } from 'firebase/firestore';
import appletConfig from './firebase-applet-config.json' with { type: 'json' };

const firebaseConfig = {
  projectId: appletConfig.projectId,
  appId: appletConfig.appId,
  apiKey: appletConfig.apiKey,
  authDomain: appletConfig.authDomain,
  firestoreDatabaseId: appletConfig.firestoreDatabaseId,
  storageBucket: appletConfig.storageBucket,
  messagingSenderId: appletConfig.messagingSenderId
};

console.log('Firebase Configuration:', JSON.stringify(firebaseConfig, null, 2));

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { ignoreUndefinedProperties: true }, firebaseConfig.firestoreDatabaseId);

async function testFetch() {
  try {
    console.log('Attempting to fetch categories from Firestore...');
    const catSnap = await getDocs(collection(db, 'categories'));
    console.log(`Successfully fetched categories! Count: ${catSnap.size}`);
    catSnap.forEach(doc => {
      console.log(`- Category Doc ID: ${doc.id}, Data:`, doc.data());
    });

    console.log('Attempting to fetch products from Firestore...');
    const prodSnap = await getDocs(collection(db, 'products'));
    console.log(`Successfully fetched products! Count: ${prodSnap.size}`);
    prodSnap.forEach(doc => {
      console.log(`- Product Doc ID: ${doc.id}, Name: ${doc.data().name}`);
    });

    console.log('Attempting to fetch notifications from Firestore...');
    const notifSnap = await getDocs(collection(db, 'notifications'));
    console.log(`Successfully fetched notifications! Count: ${notifSnap.size}`);

    console.log('Attempting to fetch settings/admin from Firestore...');
    const settingsSnap = await getDocs(collection(db, 'settings'));
    settingsSnap.forEach(doc => {
      console.log(`- Settings Doc ID: ${doc.id}, Data Keys:`, Object.keys(doc.data()));
    });

  } catch (error) {
    console.error('Error fetching from Firestore:', error);
  }
}

testFetch().then(() => process.exit(0));
