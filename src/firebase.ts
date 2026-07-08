/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, doc, getDocs, setDoc, writeBatch, setLogLevel } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import appletConfig from '../firebase-applet-config.json';

// Configuration from firebase-applet-config.json with optional environment variable overrides for Vercel
const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId
};

// Set Firestore log level to suppress harmless warning alerts about offline backend fallback in container environments
setLogLevel('error');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = firebaseConfig.firestoreDatabaseId 
  ? initializeFirestore(app, { 
      ignoreUndefinedProperties: true,
      experimentalForceLongPolling: true
    }, firebaseConfig.firestoreDatabaseId) 
  : initializeFirestore(app, { 
      ignoreUndefinedProperties: true,
      experimentalForceLongPolling: true
    });
export const auth = getAuth(app);

// Collection helper references
export const COLLECTIONS = {
  USERS: 'users',
  CATEGORIES: 'categories',
  PRODUCTS: 'products',
  ORDERS: 'orders',
  GIFTS: 'gifts',
  RECHARGES: 'recharges',
  PHONE_REQUESTS: 'phone_requests',
  NOTIFICATIONS: 'notifications',
  LOCATIONS: 'locations',
  SETTINGS: 'settings',
  TARGETED_NOTIFICATIONS: 'targeted_notifications',
  TARGETED_GIFTS: 'targeted_gifts',
  TARGETED_GIFT_LOGS: 'targeted_gift_logs',
  TICKER_TEXTS: 'ticker_texts'
};
