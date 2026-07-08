import { initializeApp } from 'firebase/app';
import { initializeFirestore, getDocs, collection, doc, getDoc } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load env variables
dotenv.config({ override: true });

// Read firebase-applet-config.json
let appletConfig: any = {};
try {
  appletConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
} catch (e) {
  console.error('Could not read firebase-applet-config.json:', e);
}

const firebaseConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId,
  appId: process.env.VITE_FIREBASE_APP_ID || appletConfig.appId,
  apiKey: process.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
  firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId
};

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('\n❌ Error: Please specify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your env before running this migration!\n');
  process.exit(1);
}

console.log('--- Initializing Migrator ---');
console.log('Firebase Project ID:', firebaseConfig.projectId);
console.log('Firebase Database ID:', firebaseConfig.firestoreDatabaseId);
console.log('Supabase Project URL:', supabaseUrl);

const firebaseApp = initializeApp(firebaseConfig);
const firestore = firebaseConfig.firestoreDatabaseId 
  ? initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true }, firebaseConfig.firestoreDatabaseId)
  : initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true });

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const COLLECTIONS = {
  USERS: 'users',
  CATEGORIES: 'categories',
  PRODUCTS: 'products',
  ORDERS: 'orders',
  GIFTS: 'gifts',
  RECHARGES: 'recharges',
  PHONE_REQUESTS: 'phone_requests',
  NOTIFICATIONS: 'notifications',
  LOCATIONS: 'locations',
  TARGETED_NOTIFICATIONS: 'targeted_notifications',
  TARGETED_GIFTS: 'targeted_gifts',
  TARGETED_GIFT_LOGS: 'targeted_gift_logs',
  TICKER_TEXTS: 'ticker_texts'
};

async function migrateCollection(firebaseCol: string, supabaseTable: string, transformer?: (data: any) => any) {
  console.log(`\n⏳ Migrating collection: "${firebaseCol}" to Supabase table: "${supabaseTable}"...`);
  try {
    const snap = await getDocs(collection(firestore, firebaseCol));
    console.log(`🔹 Fetched ${snap.size} documents from Firebase Firestore.`);
    
    if (snap.size === 0) {
      console.log(`✅ No records found in ${firebaseCol} to migrate.`);
      return;
    }

    let successCount = 0;
    for (const d of snap.docs) {
      let record = { id: d.id, ...d.data() };
      if (transformer) {
        record = transformer(record);
      }
      
      const { error } = await supabase.from(supabaseTable).upsert(record);
      if (error) {
        console.error(`❌ Failed to upsert doc ID "${d.id}" to "${supabaseTable}":`, error.message);
      } else {
        successCount++;
      }
    }
    console.log(`✅ Completed migration for "${supabaseTable}". Successfully upserted: ${successCount}/${snap.size} records.`);
  } catch (err: any) {
    console.error(`❌ Error migrating "${firebaseCol}":`, err.message || err);
  }
}

async function migrateSettings() {
  console.log('\n⏳ Migrating setting documents from "settings" collection...');
  const docIds = ['advisor', 'admin', 'general'];
  for (const docId of docIds) {
    try {
      const snap = await getDoc(doc(firestore, 'settings', docId));
      if (snap.exists()) {
        const data = snap.data();
        const { error } = await supabase.from('settings').upsert({ id: docId, data });
        if (error) {
          console.error(`❌ Failed to upsert setting "${docId}":`, error.message);
        } else {
          console.log(`✅ Successfully migrated setting "${docId}".`);
        }
      } else {
        console.log(`ℹ️ Setting document "${docId}" does not exist in Firestore.`);
      }
    } catch (err: any) {
      console.error(`❌ Error migrating settings doc "${docId}":`, err.message || err);
    }
  }
}

async function runMigration() {
  // Migrate Settings
  await migrateSettings();

  // Migrate Categories
  await migrateCollection(COLLECTIONS.CATEGORIES, 'categories', (data) => ({
    id: data.id,
    name: data.name,
    image: data.image || '',
    productCount: data.productCount ?? 0,
    sortOrder: data.sortOrder ?? 0
  }));

  // Migrate Products
  await migrateCollection(COLLECTIONS.PRODUCTS, 'products', (data) => ({
    id: data.id,
    code: data.code,
    name: data.name,
    categoryId: data.categoryId,
    categoryName: data.categoryName,
    subCategoryIds: data.subCategoryIds || [],
    description: data.description || '',
    priceYERNew: data.priceYERNew ?? (data.priceYER || 0),
    images: data.images || [],
    properties: data.properties || [],
    isOnOffer: !!data.isOnOffer,
    offerPriceNew: data.offerPriceNew || null,
    offerOldPrice: data.offerOldPrice || null,
    rating: data.rating ?? 5
  }));

  // Migrate Locations
  await migrateCollection(COLLECTIONS.LOCATIONS, 'locations', (data) => ({
    id: data.id,
    name: data.name,
    deliveryFee: data.deliveryFee ?? 0
  }));

  // Migrate Users
  await migrateCollection(COLLECTIONS.USERS, 'users', (data) => ({
    id: data.id,
    name: data.name,
    phone: data.phone,
    address: data.address || '',
    currency: data.currency || 'YER_NEW',
    balance: data.balance ?? 0,
    giftBalance: data.giftBalance ?? 0,
    favorites: data.favorites || [],
    joinDate: data.joinDate || '',
    isRegistered: !!data.isRegistered,
    deviceId: data.deviceId || ''
  }));

  // Migrate Orders
  await migrateCollection(COLLECTIONS.ORDERS, 'orders', (data) => ({
    id: data.id,
    userId: data.userId,
    userName: data.userName,
    userPhone: data.userPhone,
    address: data.address,
    deliveryFee: data.deliveryFee ?? 0,
    items: data.items || [],
    senderName: data.senderName || '',
    senderAccount: data.senderAccount || '',
    receiptImage: data.receiptImage || null,
    totalAmount: data.totalAmount ?? 0,
    currency: data.currency,
    createdAt: data.createdAt,
    status: data.status || 'pending',
    paymentMethod: data.paymentMethod,
    checkoutVia: data.checkoutVia || 'app'
  }));

  // Migrate Gifts
  await migrateCollection(COLLECTIONS.GIFTS, 'gifts', (data) => ({
    id: data.id,
    userId: data.userId,
    userName: data.userName,
    userPhone: data.userPhone,
    amount: data.amount ?? 0,
    createdAt: data.createdAt
  }));

  // Migrate Recharges
  await migrateCollection(COLLECTIONS.RECHARGES, 'recharges', (data) => ({
    id: data.id,
    userId: data.userId,
    userName: data.userName,
    userPhone: data.userPhone,
    senderName: data.senderName || '',
    senderAccount: data.senderAccount || '',
    amount: data.amount ?? 0,
    receiptImage: data.receiptImage || '',
    createdAt: data.createdAt,
    status: data.status || 'pending'
  }));

  // Migrate Phone Requests
  await migrateCollection(COLLECTIONS.PHONE_REQUESTS, 'phone_requests', (data) => ({
    id: data.id,
    userId: data.userId,
    userName: data.userName,
    oldPhone: data.oldPhone,
    newPhone: data.newPhone,
    newName: data.newName || null,
    createdAt: data.createdAt,
    status: data.status || 'pending',
    type: data.type || 'change_phone',
    newDeviceId: data.newDeviceId || null
  }));

  // Migrate Notifications
  await migrateCollection(COLLECTIONS.NOTIFICATIONS, 'notifications', (data) => ({
    id: data.id,
    userId: data.userId || null,
    title: data.title,
    message: data.message,
    createdAt: data.createdAt,
    isRead: !!data.isRead,
    image: data.image || null,
    productId: data.productId || null
  }));

  // Migrate Targeted Notifications
  await migrateCollection(COLLECTIONS.TARGETED_NOTIFICATIONS, 'targeted_notifications', (data) => ({
    id: data.id,
    title: data.title,
    message: data.message,
    createdAt: data.createdAt,
    expiryAt: data.expiryAt,
    targetType: data.targetType,
    targetValue: data.targetValue,
    isPopup: !!data.isPopup
  }));

  // Migrate Targeted Gifts
  await migrateCollection(COLLECTIONS.TARGETED_GIFTS, 'targeted_gifts', (data) => ({
    id: data.id,
    title: data.title,
    amount: data.amount ?? 0,
    createdAt: data.createdAt,
    expiryAt: data.expiryAt,
    targetType: data.targetType,
    targetValue: data.targetValue,
    daysToUse: data.daysToUse ?? 7,
    claimedUserIds: data.claimedUserIds || []
  }));

  // Migrate Targeted Gift Logs
  await migrateCollection(COLLECTIONS.TARGETED_GIFT_LOGS, 'targeted_gift_logs', (data) => ({
    id: data.id,
    userId: data.userId,
    userName: data.userName,
    userPhone: data.userPhone,
    amount: data.amount ?? 0,
    giftCampaignId: data.giftCampaignId,
    giftCampaignTitle: data.giftCampaignTitle,
    createdAt: data.createdAt,
    expiryAt: data.expiryAt,
    status: data.status || 'active'
  }));

  // Migrate Ticker Texts
  console.log('\n⏳ Migrating news ticker texts from "ticker_texts" collection...');
  try {
    const snap = await getDocs(collection(firestore, COLLECTIONS.TICKER_TEXTS));
    console.log(`🔹 Fetched ${snap.size} documents from Firebase Firestore.`);
    let index = 0;
    for (const d of snap.docs) {
      const data = d.data();
      const record = {
        id: d.id || `ticker_${index}`,
        text: data.text || '',
        sortOrder: data.sortOrder ?? index,
        createdAt: data.createdAt || new Date().toISOString()
      };
      await supabase.from('ticker_texts').upsert(record);
      index++;
    }
    console.log('✅ News ticker texts migrated.');
  } catch (err: any) {
    console.error('❌ Error migrating ticker_texts:', err.message || err);
  }

  console.log('\n🎉 ALL DONE! Your database migration from Firebase to Supabase is complete! 🎉\n');
}

runMigration().catch(err => {
  console.error('💥 Migration failed critically:', err);
  process.exit(1);
});
