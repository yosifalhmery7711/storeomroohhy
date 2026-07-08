/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  User, 
  Category, 
  Product, 
  Order, 
  ExchangeRate, 
  Gift, 
  RechargeRequest, 
  AdvisorSettings, 
  AdminSettings,
  PhoneChangeRequest,
  Notification,
  DeliveryLocation,
  TargetedNotification,
  TargetedGift,
  UserTargetedGiftLog
} from './types';
import { db, COLLECTIONS, auth } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { supabase, isSupabaseConfigured } from './supabase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  const stringified = JSON.stringify(errInfo);
  const isOfflineOrNetwork = errInfo.error.toLowerCase().includes('offline') || 
                             errInfo.error.toLowerCase().includes('network') ||
                             errInfo.error.toLowerCase().includes('failed to get document') ||
                             errInfo.error.toLowerCase().includes('could not reach') ||
                             errInfo.error.toLowerCase().includes('timeout') ||
                             errInfo.error.toLowerCase().includes('unreachable') ||
                             errInfo.error.toLowerCase().includes('unavailable') ||
                             errInfo.error.toLowerCase().includes('connection');
  
  if (isOfflineOrNetwork) {
    console.warn('Firestore Connection/Offline Fallback Warning: ', stringified);
  } else {
    console.error('Firestore Error: ', stringified);
    throw new Error(stringified);
  }
}

function handleSupabaseError(error: any, tableName: string, operation: string) {
  if (!error) return;
  const stringified = JSON.stringify(error);
  console.error(`Supabase ${tableName} ${operation} error:`, stringified);
  
  let friendlyMsg = `فشل حفظ البيانات في Supabase للجدول ${tableName}.`;
  if (error.code === '42P01' || error.code === 'PGRST205') {
    friendlyMsg = `⚠️ تنبيه هام لمتجر أم روح: جدول "${tableName}" غير موجود في قاعدة بيانات Supabase الخاصة بكِ! يرجى الذهاب إلى لوحة تحكم Supabase، ثم فتح (SQL Editor)، ونسخ محتويات ملف "supabase-schema.sql" بالكامل ولصقها هناك والنقر على (Run) لإنشاء الجداول وسياسات الأمان بنجاح.`;
    if (typeof window !== 'undefined') {
      window.alert(friendlyMsg);
    }
  } else if (error.code === '23505') {
    friendlyMsg = `⚠️ خطأ: الاسم أو المعرّف الذي أدخلتيه مكرر وموجود بالفعل في جدول "${tableName}". يرجى اختيار اسم أو رمز فريد.`;
    if (typeof window !== 'undefined') {
      window.alert(friendlyMsg);
    }
  } else if (error.message) {
    friendlyMsg = `⚠️ خطأ في Supabase: ${error.message}`;
    if (typeof window !== 'undefined') {
      console.warn("Supabase Error Details:", friendlyMsg);
    }
  }
}


// Helper to safely load JSON from localStorage
function loadFromStorage<T>(key: string, defaultValue: T): T {
  const data = localStorage.getItem(key);
  if (!data) return defaultValue;
  try {
    return JSON.parse(data) as T;
  } catch (e) {
    return defaultValue;
  }
}

// Helper to save JSON to localStorage
function saveToStorage<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// Seed Initial Data
const DEFAULT_USER: User = {
  id: 'USER_DEFAULT',
  name: 'زائر كريم',
  phone: '777111222',
  address: '', // empty address initially, let them skip
  currency: 'YER_NEW',
  balance: 0, // Changed to 0 as requested
  giftBalance: 0, // Changed to 0 as requested
  favorites: [],
  joinDate: '2026-06',
  isRegistered: false
};

const DEFAULT_CATEGORIES: Category[] = [];

const DEFAULT_PRODUCTS: Product[] = [];

const DEFAULT_EXCHANGE_RATE: ExchangeRate = {
  yerOldFactor: 2.9, // Price_Old = Price_New / 2.9 (round to higher 100)
  sarFactor: 410,    // Price_SAR = Price_New / 410 (round to higher integer)
};

const DEFAULT_ADVISOR_SETTINGS: AdvisorSettings = {
  image: 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&q=80&w=400', // A beautiful, heartwarming little girl avatar
  name: 'رُوْح',
  title: 'مستشارة العملاء الموثوقة',
};

const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  code: '1234',
  workerCode: '1111',
  bankAccounts: [
    { currency: 'YER_NEW', bankName: 'الكريمي المميز (ريال يمني جديد)', accountNumber: '967739563915', accountName: 'متجر أم روح' },
    { currency: 'YER_OLD', bankName: 'الكريمي المميز (ريال يمني قديم)', accountNumber: '967739563915', accountName: 'متجر أم روح' },
    { currency: 'SAR', bankName: 'الكريمي المميز (ريال سعودي)', accountNumber: '967739563915', accountName: 'متجر أم روح' }
  ],
  androidDownloadUrl: 'https://archive.org/download/ruh-store/RuhStore.apk',
  whatsappNumber: '967739563915',
  currentAppUrl: '',
  kuraimiAccountName: 'أم روح',
  kuraimiAccountNumber: '967739563915',
  najmReceiverName: 'روح أحمد علي'
};

const DEFAULT_OFFERS_IMAGES: string[] = [];

const DEFAULT_NOTIFICATIONS: Notification[] = [
  {
    id: 'NOTIF_1',
    title: 'مرحباً بك في متجر أم روح 🌸',
    message: 'يسعدنا انضمامك إلينا! استكشفي أقسامنا المتنوعة واستمتعي بتخفيضات وعروض حصرية على الأدوات المنزلية، الملابس، الألعاب، ومستحضرات التجميل.',
    createdAt: new Date().toISOString(),
    isRead: false
  },
  {
    id: 'NOTIF_2',
    title: 'أهلاً بكِ في متجرنا 🌸',
    message: 'لقد تم إنشاء حسابكِ بنجاح! يمكنكِ الآن البدء بالتسوق وإتمام طلباتكِ عبر الواتساب بكل سهولة ويسر. تمنياتنا لكِ برحلة تسوق ممتعة! ✨',
    createdAt: new Date().toISOString(),
    isRead: false
  }
];

const DEFAULT_LOCATIONS: DeliveryLocation[] = [
  { id: 'LOC_1', name: 'صنعاء - الأمانة', deliveryFee: 1000 },
  { id: 'LOC_2', name: 'عدن - كريتر / المنصورة', deliveryFee: 2000 },
  { id: 'LOC_3', name: 'تعز - المدينة', deliveryFee: 1500 },
  { id: 'LOC_4', name: 'إب - المدينة', deliveryFee: 1500 },
  { id: 'LOC_5', name: 'الحديدة - المدينة', deliveryFee: 1800 }
];

// Database Class definition
export class Database {
  // --- Google Drive / Google Sheets Backup Config ---
  private static DEFAULT_GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbychcCW3ycX_Eptt_6iavMzPnq5_lLQIpAaOUOAHR4ZhKDMemPAFeRavrLuEvkwq8jj/exec";

  static isBackupMode(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('amrwh_use_google_backup') === 'true';
  }

  static setBackupMode(status: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('amrwh_use_google_backup', status ? 'true' : 'false');
    console.log(`Database backup mode set to: ${status ? 'Google Sheets' : 'Supabase/Firestore'}`);
  }

  static getGoogleScriptUrl(): string {
    if (typeof window === 'undefined') return this.DEFAULT_GOOGLE_SCRIPT_URL;
    return localStorage.getItem('amrwh_google_script_url') || this.DEFAULT_GOOGLE_SCRIPT_URL;
  }

  static setGoogleScriptUrl(url: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('amrwh_google_script_url', url);
    console.log(`Google Script URL set to: ${url}`);
  }

  static getGoogleBackupStats() {
    if (typeof window === 'undefined') {
      return { status: 'غير مفحوص ⚪', productsCount: 0, categoriesCount: 0, ordersCount: 0, lastCheck: '' };
    }
    return {
      status: localStorage.getItem('amrwh_google_status') || 'غير مفحوص ⚪',
      productsCount: parseInt(localStorage.getItem('amrwh_google_products_count') || '0', 10),
      categoriesCount: parseInt(localStorage.getItem('amrwh_google_categories_count') || '0', 10),
      ordersCount: parseInt(localStorage.getItem('amrwh_google_orders_count') || '0', 10),
      lastCheck: localStorage.getItem('amrwh_google_last_check') || 'لم يتم الفحص بعد'
    };
  }

  static updateGoogleBackupStats(data: any, success = true, errorStr?: string): void {
    if (typeof window === 'undefined') return;
    if (success) {
      localStorage.setItem('amrwh_google_status', 'متصل ومستقر ✅');
      localStorage.setItem('amrwh_google_last_check', new Date().toLocaleString('ar-EG'));
      
      let pCount = 0;
      let cCount = 0;
      let oCount = 0;

      if (data) {
        if (Array.isArray(data)) {
          pCount = data.length;
        } else {
          // Check standard structures in case script returns nested keys
          const prods = data.products || (data.data && data.data.products);
          const cats = data.categories || (data.data && data.data.categories);
          const ords = data.orders || (data.data && data.data.orders);

          if (Array.isArray(prods)) pCount = prods.length;
          else if (Array.isArray(data.data)) pCount = data.data.length;

          if (Array.isArray(cats)) cCount = cats.length;
          if (Array.isArray(ords)) oCount = ords.length;
        }
      }

      // Sync local counts if sheet didn't return any to maintain visual integrity
      if (pCount > 0) {
        localStorage.setItem('amrwh_google_products_count', String(pCount));
      } else {
        localStorage.setItem('amrwh_google_products_count', String(this.getProducts().length));
      }

      if (cCount > 0) {
        localStorage.setItem('amrwh_google_categories_count', String(cCount));
      } else {
        const localCats = loadFromStorage<any[]>('amrwh_categories', []).length;
        localStorage.setItem('amrwh_google_categories_count', String(localCats || 13));
      }

      if (oCount > 0) {
        localStorage.setItem('amrwh_google_orders_count', String(oCount));
      } else {
        localStorage.setItem('amrwh_google_orders_count', String(this.getOrders().length));
      }
    } else {
      localStorage.setItem('amrwh_google_status', `خطأ في الاتصال ❌ (${errorStr || 'غير معروف'})`);
      localStorage.setItem('amrwh_google_last_check', new Date().toLocaleString('ar-EG'));
    }
  }

  static async fetchFromGoogleScript(action: string, payload: any = {}): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const url = this.getGoogleScriptUrl();
      const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({ action, ...payload })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }
      this.updateGoogleBackupStats(result, true);
      return { success: true, data: result };
    } catch (error: any) {
      console.error(`Google Script fetch error for ${action}:`, error);
      this.updateGoogleBackupStats(null, false, error.message || String(error));
      return { success: false, error: error.message || String(error) };
    }
  }

  static async syncEventToGoogleScript(action: string, payload: any = {}): Promise<void> {
    if (!this.isBackupMode()) return;
    try {
      const res = await this.fetchFromGoogleScript(action, payload);
      if (res.success) {
        console.log(`Successfully synced event '${action}' to Google Sheets.`);
      } else {
        console.warn(`Failed to sync event '${action}' to Google Sheets: ${res.error}`);
      }
    } catch (err) {
      console.error(`Error syncing event '${action}':`, err);
    }
  }

  static async syncAllDataToGoogleDrive(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const products = this.getProducts();
      const categories = loadFromStorage<Category[]>(this.KEYS.CATEGORIES, []);
      const locations = loadFromStorage<DeliveryLocation[]>(this.KEYS.LOCATIONS, []);
      const orders = this.getOrders();
      const tickerTexts = this.getTickerTexts();
      const settings = this.getAdminSettings();
      const advisorSettings = this.getAdvisorSettings();
      const exchangeRate = this.getExchangeRate();
      const phoneRequests = this.getPhoneRequests();
      const notifications = loadFromStorage<Notification[]>(this.KEYS.NOTIFICATIONS, []);
      const targetedNotifications = this.getTargetedNotifications();
      const targetedGifts = this.getTargetedGifts();
      const userTargetedGiftLogs = this.getUserTargetedGiftLogs();
      const allUsers = loadFromStorage<User[]>('amrwh_all_users_list', []);

      const payload = {
        products,
        categories,
        locations,
        orders,
        tickerTexts,
        settings,
        advisorSettings,
        exchangeRate,
        phoneRequests,
        notifications,
        targetedNotifications,
        targetedGifts,
        userTargetedGiftLogs,
        allUsers
      };

      return await this.fetchFromGoogleScript('syncAllData', { allData: payload });
    } catch (err: any) {
      console.error("Full database export sync failed:", err);
      return { success: false, error: err.message || String(err) };
    }
  }

  // Initialize storage keys
  private static KEYS = {
    USER: 'amrwh_user',
    CATEGORIES: 'amrwh_categories',
    PRODUCTS: 'amrwh_products',
    ORDERS: 'amrwh_orders',
    EXCHANGE_RATE: 'amrwh_exchange_rate',
    ADVISOR: 'amrwh_advisor',
    ADMIN: 'amrwh_admin',
    GIFTS: 'amrwh_gifts',
    RECHARGES: 'amrwh_recharges',
    OFFERS: 'amrwh_offers',
    PHONE_REQUESTS: 'amrwh_phone_requests',
    NOTIFICATIONS: 'amrwh_notifications',
    LOCATIONS: 'amrwh_locations',
    TARGETED_NOTIFICATIONS: 'amrwh_targeted_notifications',
    TARGETED_GIFTS: 'amrwh_targeted_gifts',
    TARGETED_GIFT_LOGS: 'amrwh_targeted_gift_logs',
    TICKER_TEXTS: 'amrwh_ticker_texts'
  };

  static initialize(): void {
    if (typeof window !== 'undefined') {
      let devId = localStorage.getItem('amrwh_device_id');
      if (!devId) {
        devId = 'DEV-' + Math.floor(1000000 + Math.random() * 9000000);
        localStorage.setItem('amrwh_device_id', devId);
      }
    }

    if (!localStorage.getItem(this.KEYS.USER)) {
      const randomSuffix = Math.floor(1000000 + Math.random() * 9000000); // 7 digits
      const randomPhone = `77${randomSuffix}`;
      const randomNameSuffix = Math.floor(100 + Math.random() * 900);
      const randomId = 'USR-' + Math.floor(10000 + Math.random() * 90000);
      const devId = typeof window !== 'undefined' ? localStorage.getItem('amrwh_device_id') || '' : '';

      const uniqueUser: User = {
        id: randomId,
        name: `عميل_جديد_${randomNameSuffix}`,
        phone: randomPhone,
        address: '',
        currency: 'YER_NEW',
        balance: 0,
        giftBalance: 0,
        favorites: [],
        joinDate: new Date().toISOString().substring(0, 7),
        isRegistered: false,
        deviceId: devId
      };
      saveToStorage(this.KEYS.USER, uniqueUser);
    }
    if (!localStorage.getItem(this.KEYS.CATEGORIES)) saveToStorage(this.KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    if (!localStorage.getItem(this.KEYS.PRODUCTS)) saveToStorage(this.KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    if (!localStorage.getItem(this.KEYS.ORDERS)) saveToStorage(this.KEYS.ORDERS, []);
    if (!localStorage.getItem(this.KEYS.EXCHANGE_RATE)) saveToStorage(this.KEYS.EXCHANGE_RATE, DEFAULT_EXCHANGE_RATE);
    if (!localStorage.getItem(this.KEYS.ADVISOR)) saveToStorage(this.KEYS.ADVISOR, DEFAULT_ADVISOR_SETTINGS);
    if (!localStorage.getItem(this.KEYS.ADMIN)) saveToStorage(this.KEYS.ADMIN, DEFAULT_ADMIN_SETTINGS);
    if (!localStorage.getItem(this.KEYS.GIFTS)) saveToStorage(this.KEYS.GIFTS, []);
    if (!localStorage.getItem(this.KEYS.RECHARGES)) saveToStorage(this.KEYS.RECHARGES, []);
    if (!localStorage.getItem(this.KEYS.OFFERS)) saveToStorage(this.KEYS.OFFERS, DEFAULT_OFFERS_IMAGES);
    if (!localStorage.getItem(this.KEYS.PHONE_REQUESTS)) saveToStorage(this.KEYS.PHONE_REQUESTS, []);
    if (!localStorage.getItem(this.KEYS.NOTIFICATIONS)) saveToStorage(this.KEYS.NOTIFICATIONS, DEFAULT_NOTIFICATIONS);
    if (!localStorage.getItem(this.KEYS.LOCATIONS)) saveToStorage(this.KEYS.LOCATIONS, DEFAULT_LOCATIONS);
    if (!localStorage.getItem(this.KEYS.TARGETED_NOTIFICATIONS)) saveToStorage(this.KEYS.TARGETED_NOTIFICATIONS, []);
    if (!localStorage.getItem(this.KEYS.TARGETED_GIFTS)) saveToStorage(this.KEYS.TARGETED_GIFTS, []);
    if (!localStorage.getItem(this.KEYS.TARGETED_GIFT_LOGS)) saveToStorage(this.KEYS.TARGETED_GIFT_LOGS, []);
    if (!localStorage.getItem(this.KEYS.TICKER_TEXTS)) {
      saveToStorage(this.KEYS.TICKER_TEXTS, [
        'مرحباً بكم في متجر أم روح 🌸 منصتكم الأولى للتسوق للأسر المنتجة باليمن!',
        'توصيل سريع ومضمون لكافة المحافظات اليمنية 🚚',
        'خصومات وعروض مميزة مستمرة على كافة الأقسام 🌟'
      ]);
    }
  }

  static seed(): void {
    this.initialize();
  }

  static async syncFromFirestore(onSyncComplete?: () => void, force: boolean = false): Promise<void> {
    try {
      this.initialize();
      
      if (this.isBackupMode()) {
        console.log('Database Sync: Backup Mode is Active. Fetching from Google Sheets...');
        const res = await this.fetchFromGoogleScript('getProducts');
        if (res.success && res.data) {
          const products = Array.isArray(res.data) ? res.data : (res.data.products || []);
          if (products && products.length > 0) {
            saveToStorage(this.KEYS.PRODUCTS, products);
            console.log(`Database Sync: Successfully loaded ${products.length} products from Google Sheets.`);
          }
          const categories = res.data.categories || [];
          if (categories && categories.length > 0) {
            saveToStorage(this.KEYS.CATEGORIES, categories);
          }
          saveToStorage('amrwh_last_sync_success', 'true');
          saveToStorage('amrwh_last_sync_timestamp', new Date().toISOString());
        }
        if (onSyncComplete) onSyncComplete();
        return;
      }
      
      // Throttle background syncs to avoid exceeding free-tier Firestore quota
      if (!force) {
        const lastSync = this.getLastSyncTime();
        if (lastSync) {
          const diffMs = Date.now() - new Date(lastSync).getTime();
          if (diffMs < 5 * 60 * 1000) { // 5 minutes throttle
            console.log('Database Sync: Throttled background sync (last sync was less than 5 min ago)');
            if (onSyncComplete) onSyncComplete();
            return;
          }
        }
      }

      if (isSupabaseConfigured()) {
        console.log('Database Sync: Syncing from Supabase...');
        const [
          advRes,
          admRes,
          genRes,
          catRes,
          prodRes,
          locRes,
          usersRes,
          orderRes,
          giftRes,
          rechRes,
          phoneRes,
          notifRes,
          tNotifRes,
          tGiftsRes,
          tLogsRes,
          tickerRes
        ] = await Promise.all([
          supabase!.from('settings').select('*').eq('id', 'advisor').maybeSingle(),
          supabase!.from('settings').select('*').eq('id', 'admin').maybeSingle(),
          supabase!.from('settings').select('*').eq('id', 'general').maybeSingle(),
          supabase!.from('categories').select('*'),
          supabase!.from('products').select('*'),
          supabase!.from('locations').select('*'),
          supabase!.from('users').select('*'),
          supabase!.from('orders').select('*'),
          supabase!.from('gifts').select('*'),
          supabase!.from('recharges').select('*'),
          supabase!.from('phone_requests').select('*'),
          supabase!.from('notifications').select('*'),
          supabase!.from('targeted_notifications').select('*'),
          supabase!.from('targeted_gifts').select('*'),
          supabase!.from('targeted_gift_logs').select('*'),
          supabase!.from('ticker_texts').select('*')
        ]);

        if (catRes.error) console.warn("Supabase categories load error:", catRes.error);
        if (prodRes.error) console.warn("Supabase products load error:", prodRes.error);

        // Process Advisor Settings
        if (advRes.data) {
          saveToStorage(this.KEYS.ADVISOR, advRes.data.data);
        } else {
          supabase!.from('settings').insert({ id: 'advisor', data: DEFAULT_ADVISOR_SETTINGS }).then(undefined, () => {});
        }

        // Process Admin Settings
        if (admRes.data) {
          saveToStorage(this.KEYS.ADMIN, admRes.data.data);
        } else {
          supabase!.from('settings').insert({ id: 'admin', data: DEFAULT_ADMIN_SETTINGS }).then(undefined, () => {});
        }

        // Process General Settings
        if (genRes.data) {
          const genData = genRes.data.data;
          if (genData?.exchangeRate) {
            saveToStorage(this.KEYS.EXCHANGE_RATE, genData.exchangeRate);
          }
          if (genData?.offers) {
            saveToStorage(this.KEYS.OFFERS, genData.offers);
          }
          if (genData?.tickerTexts && Array.isArray(genData.tickerTexts) && genData.tickerTexts.length > 0) {
            saveToStorage(this.KEYS.TICKER_TEXTS, genData.tickerTexts);
          }
        } else {
          supabase!.from('settings').insert({ id: 'general', data: { exchangeRate: DEFAULT_EXCHANGE_RATE, offers: DEFAULT_OFFERS_IMAGES } }).then(undefined, () => {});
        }

        // Process News Ticker
        if (tickerRes.data && tickerRes.data.length > 0) {
          const sorted = [...tickerRes.data].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          const texts = sorted.map(t => t.text).filter(Boolean);
          saveToStorage(this.KEYS.TICKER_TEXTS, texts);
        } else {
          const defaultTicker = [
            'مرحباً بكم في متجر أم روح 🌸 منصتكم الأولى للتسوق للأسر المنتجة باليمن!',
            'توصيل سريع ومضمون لكافة المحافظات اليمنية 🚚',
            'خصومات وعروض مميزة مستمرة على كافة الأقسام 🌟'
          ];
          defaultTicker.forEach((text, i) => {
            supabase!.from('ticker_texts').insert({ id: `ticker_${i}`, text, sortOrder: i, createdAt: new Date().toISOString() }).then(undefined, () => {});
          });
          saveToStorage(this.KEYS.TICKER_TEXTS, defaultTicker);
        }

        // Process Categories
        if (catRes.data && catRes.data.length > 0) {
          saveToStorage(this.KEYS.CATEGORIES, catRes.data);
        } else {
          DEFAULT_CATEGORIES.forEach(cat => {
            supabase!.from('categories').insert(cat).then(undefined, () => {});
          });
          saveToStorage(this.KEYS.CATEGORIES, DEFAULT_CATEGORIES);
        }

        // Process Products
        if (prodRes.data && prodRes.data.length > 0) {
          saveToStorage(this.KEYS.PRODUCTS, prodRes.data);
        } else {
          DEFAULT_PRODUCTS.forEach(prod => {
            supabase!.from('products').insert(prod).then(undefined, () => {});
          });
          saveToStorage(this.KEYS.PRODUCTS, DEFAULT_PRODUCTS);
        }

        // Process Locations
        if (locRes.data && locRes.data.length > 0) {
          saveToStorage(this.KEYS.LOCATIONS, locRes.data);
        } else {
          DEFAULT_LOCATIONS.forEach(loc => {
            supabase!.from('locations').insert(loc).then(undefined, () => {});
          });
          saveToStorage(this.KEYS.LOCATIONS, DEFAULT_LOCATIONS);
        }

        // Process Users
        const allUsers: User[] = (usersRes.data || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          phone: u.phone,
          address: u.address,
          currency: u.currency,
          balance: Number(u.balance || 0),
          giftBalance: Number(u.giftBalance || 0),
          favorites: u.favorites || [],
          joinDate: u.joinDate,
          isRegistered: !!u.isRegistered,
          deviceId: u.deviceId
        }));
        if (allUsers.length > 0) {
          saveToStorage('amrwh_all_users_list', allUsers);
          const active = this.getUser();
          let found = allUsers.find(u => u.id === active.id);
          const currentDevId = typeof window !== 'undefined' ? localStorage.getItem('amrwh_device_id') || '' : '';
          if (!found && currentDevId) {
            found = allUsers.find(u => u.deviceId === currentDevId && u.isRegistered);
          }
          if (found) {
            if (!found.deviceId && currentDevId) {
              found.deviceId = currentDevId;
              supabase!.from('users').update({ deviceId: currentDevId }).eq('id', found.id).then(undefined, () => {});
            }
            saveToStorage(this.KEYS.USER, found);
          } else {
            if (!active.deviceId && currentDevId) {
              active.deviceId = currentDevId;
            }
            supabase!.from('users').insert({
              id: active.id,
              name: active.name,
              phone: active.phone,
              address: active.address,
              currency: active.currency,
              balance: active.balance,
              giftBalance: active.giftBalance ?? 0,
              favorites: active.favorites || [],
              joinDate: active.joinDate || '',
              isRegistered: !!active.isRegistered,
              deviceId: active.deviceId || ''
            }).then(undefined, () => {});
          }
        } else {
          const active = this.getUser();
          const currentDevId = typeof window !== 'undefined' ? localStorage.getItem('amrwh_device_id') || '' : '';
          if (!active.deviceId && currentDevId) {
            active.deviceId = currentDevId;
          }
          supabase!.from('users').insert({
            id: active.id,
            name: active.name,
            phone: active.phone,
            address: active.address,
            currency: active.currency,
            balance: active.balance,
            giftBalance: active.giftBalance ?? 0,
            favorites: active.favorites || [],
            joinDate: active.joinDate || '',
            isRegistered: !!active.isRegistered,
            deviceId: active.deviceId || ''
          }).then(undefined, () => {});
        }

        // Process Orders
        saveToStorage(this.KEYS.ORDERS, orderRes.data || []);

        // Process Gifts
        saveToStorage(this.KEYS.GIFTS, giftRes.data || []);

        // Process Recharges
        saveToStorage(this.KEYS.RECHARGES, rechRes.data || []);

        // Process Phone Requests
        saveToStorage(this.KEYS.PHONE_REQUESTS, phoneRes.data || []);

        // Process Notifications
        if (notifRes.data && notifRes.data.length > 0) {
          saveToStorage(this.KEYS.NOTIFICATIONS, notifRes.data);
        } else {
          DEFAULT_NOTIFICATIONS.forEach(n => {
            supabase!.from('notifications').insert(n).then(undefined, () => {});
          });
          saveToStorage(this.KEYS.NOTIFICATIONS, DEFAULT_NOTIFICATIONS);
        }

        // Process Targeted Notifications
        saveToStorage(this.KEYS.TARGETED_NOTIFICATIONS, tNotifRes.data || []);

        // Process Targeted Gifts
        saveToStorage(this.KEYS.TARGETED_GIFTS, tGiftsRes.data || []);

        // Process Targeted Gift Logs
        saveToStorage(this.KEYS.TARGETED_GIFT_LOGS, tLogsRes.data || []);

        // Save synchronization metadata
        saveToStorage('amrwh_last_sync_success', 'true');
        saveToStorage('amrwh_last_sync_timestamp', new Date().toISOString());

        if (onSyncComplete) onSyncComplete();
        return;
      }
      
      // Perform all read queries concurrently in parallel with a defensive 4000ms timeout
      // This protects the application from freezing or throwing 10s timeout warnings in limited networks
      const [
        advDoc,
        admDoc,
        genDoc,
        catSnap,
        prodSnap,
        locSnap,
        usersSnap,
        orderSnap,
        giftSnap,
        rechSnap,
        phoneSnap,
        notifSnap,
        tNotifSnap,
        tGiftsSnap,
        tLogsSnap,
        tickerSnap
      ] = await Promise.race([
        Promise.all([
          getDoc(doc(db, COLLECTIONS.SETTINGS, 'advisor')),
          getDoc(doc(db, COLLECTIONS.SETTINGS, 'admin')),
          getDoc(doc(db, COLLECTIONS.SETTINGS, 'general')),
          getDocs(collection(db, COLLECTIONS.CATEGORIES)),
          getDocs(collection(db, COLLECTIONS.PRODUCTS)),
          getDocs(collection(db, COLLECTIONS.LOCATIONS)),
          getDocs(collection(db, COLLECTIONS.USERS)),
          getDocs(collection(db, COLLECTIONS.ORDERS)),
          getDocs(collection(db, COLLECTIONS.GIFTS)),
          getDocs(collection(db, COLLECTIONS.RECHARGES)),
          getDocs(collection(db, COLLECTIONS.PHONE_REQUESTS)),
          getDocs(collection(db, COLLECTIONS.NOTIFICATIONS)),
          getDocs(collection(db, COLLECTIONS.TARGETED_NOTIFICATIONS)),
          getDocs(collection(db, COLLECTIONS.TARGETED_GIFTS)),
          getDocs(collection(db, COLLECTIONS.TARGETED_GIFT_LOGS)),
          getDocs(collection(db, COLLECTIONS.TICKER_TEXTS))
        ]),
        new Promise<any[]>((_, reject) => 
          setTimeout(() => reject(new Error('Firestore operation timeout (4000ms)')), 4000)
        )
      ]);

      // 1. Process Settings (Advisor, Admin, General)
      if (advDoc.exists()) {
        const advData = advDoc.data() as AdvisorSettings;
        saveToStorage(this.KEYS.ADVISOR, advData);
      } else {
        setDoc(doc(db, COLLECTIONS.SETTINGS, 'advisor'), DEFAULT_ADVISOR_SETTINGS)
          .catch(err => console.warn('Non-blocking init write failed:', err));
      }

      if (admDoc.exists()) {
        const admData = admDoc.data() as AdminSettings;
        saveToStorage(this.KEYS.ADMIN, admData);
      } else {
        setDoc(doc(db, COLLECTIONS.SETTINGS, 'admin'), DEFAULT_ADMIN_SETTINGS)
          .catch(err => console.warn('Non-blocking init write failed:', err));
      }

      if (genDoc.exists()) {
        const genData = genDoc.data();
        if (genData?.exchangeRate) {
          saveToStorage(this.KEYS.EXCHANGE_RATE, genData.exchangeRate);
        }
        if (genData?.offers) {
          saveToStorage(this.KEYS.OFFERS, genData.offers);
        }
        if (genData?.tickerTexts && Array.isArray(genData.tickerTexts) && genData.tickerTexts.length > 0) {
          saveToStorage(this.KEYS.TICKER_TEXTS, genData.tickerTexts);
        }
      } else {
        setDoc(doc(db, COLLECTIONS.SETTINGS, 'general'), {
          exchangeRate: DEFAULT_EXCHANGE_RATE,
          offers: DEFAULT_OFFERS_IMAGES
        }).catch(err => console.warn('Non-blocking init write failed:', err));
      }

      // Process News Ticker Texts from the dedicated collection (table)
      if (tickerSnap && !tickerSnap.empty) {
        const tickerList: any[] = [];
        tickerSnap.forEach(d => tickerList.push(d.data()));
        tickerList.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const texts = tickerList.map(item => item.text).filter(Boolean);
        if (texts.length > 0) {
          saveToStorage(this.KEYS.TICKER_TEXTS, texts);
        }
      } else {
        const defaultTicker = [
          'مرحباً بكم في متجر أم روح 🌸 منصتكم الأولى للتسوق للأسر المنتجة باليمن!',
          'توصيل سريع ومضمون لكافة المحافظات اليمنية 🚚',
          'خصومات وعروض مميز مستمرة على كافة الأقسام 🌟'
        ];
        defaultTicker.forEach((text, i) => {
          setDoc(doc(db, COLLECTIONS.TICKER_TEXTS, `ticker_${i}`), {
            id: `ticker_${i}`,
            text,
            sortOrder: i,
            createdAt: new Date().toISOString()
          }).catch(() => {});
        });
        saveToStorage(this.KEYS.TICKER_TEXTS, defaultTicker);
      }

      // 2. Process Categories
      if (catSnap.empty) {
        DEFAULT_CATEGORIES.forEach(cat => {
          setDoc(doc(db, COLLECTIONS.CATEGORIES, cat.id), cat)
            .catch(err => console.warn('Non-blocking init write failed:', err));
        });
      } else {
        const cats: Category[] = [];
        catSnap.forEach(d => cats.push(d.data() as Category));
        saveToStorage(this.KEYS.CATEGORIES, cats);
      }

      // 3. Process Products
      if (prodSnap.empty) {
        DEFAULT_PRODUCTS.forEach(prod => {
          setDoc(doc(db, COLLECTIONS.PRODUCTS, prod.id), prod)
            .catch(err => console.warn('Non-blocking init write failed:', err));
        });
      } else {
        const prods: Product[] = [];
        prodSnap.forEach(d => prods.push(d.data() as Product));
        saveToStorage(this.KEYS.PRODUCTS, prods);
      }

      // 4. Process Locations
      if (locSnap.empty) {
        DEFAULT_LOCATIONS.forEach(loc => {
          setDoc(doc(db, COLLECTIONS.LOCATIONS, loc.id), loc)
            .catch(err => console.warn('Non-blocking init write failed:', err));
        });
      } else {
        const locs: DeliveryLocation[] = [];
        locSnap.forEach(d => locs.push(d.data() as DeliveryLocation));
        saveToStorage(this.KEYS.LOCATIONS, locs);
      }

      // 5. Process Users
      const allUsers: User[] = [];
      usersSnap.forEach(d => allUsers.push(d.data() as User));
      if (allUsers.length > 0) {
        saveToStorage('amrwh_all_users_list', allUsers);
        const active = this.getUser();
        let found = allUsers.find(u => u.id === active.id);
        
        const currentDevId = typeof window !== 'undefined' ? localStorage.getItem('amrwh_device_id') || '' : '';
        if (!found && currentDevId) {
          found = allUsers.find(u => u.deviceId === currentDevId && u.isRegistered);
        } else if (found && !found.isRegistered && currentDevId) {
          const registeredDevUser = allUsers.find(u => u.deviceId === currentDevId && u.isRegistered);
          if (registeredDevUser) {
            found = registeredDevUser;
          }
        }

        if (found) {
          if (!found.deviceId && currentDevId) {
            found.deviceId = currentDevId;
            setDoc(doc(db, COLLECTIONS.USERS, found.id), found)
              .catch(err => console.warn('Non-blocking user update failed:', err));
          }
          saveToStorage(this.KEYS.USER, found);
        } else {
          if (!active.deviceId && currentDevId) {
            active.deviceId = currentDevId;
          }
          setDoc(doc(db, COLLECTIONS.USERS, active.id), active)
            .catch(err => console.warn('Non-blocking user save failed:', err));
        }
      } else {
        const active = this.getUser();
        const currentDevId = typeof window !== 'undefined' ? localStorage.getItem('amrwh_device_id') || '' : '';
        if (!active.deviceId && currentDevId) {
          active.deviceId = currentDevId;
        }
        setDoc(doc(db, COLLECTIONS.USERS, active.id), active)
          .catch(err => console.warn('Non-blocking user save failed:', err));
      }

      // 6. Process Orders
      const orders: Order[] = [];
      orderSnap.forEach(d => orders.push(d.data() as Order));
      saveToStorage(this.KEYS.ORDERS, orders);

      // 7. Process Gifts
      const gifts: Gift[] = [];
      giftSnap.forEach(d => gifts.push(d.data() as Gift));
      saveToStorage(this.KEYS.GIFTS, gifts);

      // 8. Process Recharges
      const recharges: RechargeRequest[] = [];
      rechSnap.forEach(d => recharges.push(d.data() as RechargeRequest));
      saveToStorage(this.KEYS.RECHARGES, recharges);

      // 9. Process Phone Requests
      const phoneReqs: PhoneChangeRequest[] = [];
      phoneSnap.forEach(d => phoneReqs.push(d.data() as PhoneChangeRequest));
      saveToStorage(this.KEYS.PHONE_REQUESTS, phoneReqs);

      // 10. Process Notifications
      if (notifSnap.empty) {
        DEFAULT_NOTIFICATIONS.forEach(n => {
          setDoc(doc(db, COLLECTIONS.NOTIFICATIONS, n.id), n)
            .catch(err => console.warn('Non-blocking init write failed:', err));
        });
      } else {
        const notifications: Notification[] = [];
        notifSnap.forEach(d => notifications.push(d.data() as Notification));
        saveToStorage(this.KEYS.NOTIFICATIONS, notifications);
      }

      // 11. Process Targeted Notifications
      const tNotifications: TargetedNotification[] = [];
      tNotifSnap.forEach(d => tNotifications.push(d.data() as TargetedNotification));
      saveToStorage(this.KEYS.TARGETED_NOTIFICATIONS, tNotifications);

      // 12. Process Targeted Gifts
      const tGifts: TargetedGift[] = [];
      tGiftsSnap.forEach(d => tGifts.push(d.data() as TargetedGift));
      saveToStorage(this.KEYS.TARGETED_GIFTS, tGifts);

      // 13. Process Targeted Gift Logs
      const tLogs: UserTargetedGiftLog[] = [];
      tLogsSnap.forEach(d => tLogs.push(d.data() as UserTargetedGiftLog));
      saveToStorage(this.KEYS.TARGETED_GIFT_LOGS, tLogs);

      // Save synchronization metadata
      saveToStorage('amrwh_last_sync_success', 'true');
      saveToStorage('amrwh_last_sync_timestamp', new Date().toISOString());

      if (onSyncComplete) onSyncComplete();
    } catch (e) {
      console.warn("Failed to sync, trying Google Sheets backup fallback...", e);
      try {
        const res = await this.fetchFromGoogleScript('getProducts');
        if (res.success && res.data) {
          const products = Array.isArray(res.data) ? res.data : (res.data.products || []);
          if (products && products.length > 0) {
            saveToStorage(this.KEYS.PRODUCTS, products);
          }
          const categories = res.data.categories || [];
          if (categories && categories.length > 0) {
            saveToStorage(this.KEYS.CATEGORIES, categories);
          }
          saveToStorage('amrwh_last_sync_success', 'true');
          saveToStorage('amrwh_last_sync_timestamp', new Date().toISOString());
        }
      } catch (backupErr) {
        console.error("Google Sheets backup fallback also failed:", backupErr);
      }
      if (onSyncComplete) onSyncComplete();
    }
  }

  static hasSyncedOnce(): boolean {
    return localStorage.getItem('amrwh_last_sync_success') === 'true';
  }

  static getLastSyncTime(): string | null {
    return localStorage.getItem('amrwh_last_sync_timestamp');
  }

  static getAdminCode(): string {
    return this.getAdminSettings().code;
  }

  // --- USER OPERATIONS ---
  static getUser(): User {
    this.initialize();
    const u = loadFromStorage<User>(this.KEYS.USER, DEFAULT_USER);
    if (localStorage.getItem('amrwh_customer_registered') === 'true') {
      u.isRegistered = true;
    }
    if (typeof window !== 'undefined' && !u.deviceId) {
      u.deviceId = localStorage.getItem('amrwh_device_id') || '';
      saveToStorage(this.KEYS.USER, u);
    }
    return u;
  }

  static saveUser(user: User): void {
    if (user.isRegistered) {
      localStorage.setItem('amrwh_customer_registered', 'true');
    }
    saveToStorage(this.KEYS.USER, user);
    this.syncEventToGoogleScript('saveUser', { user });
    if (isSupabaseConfigured()) {
      supabase!.from('users').upsert({
        id: user.id,
        name: user.name,
        phone: user.phone,
        address: user.address,
        currency: user.currency,
        balance: user.balance,
        giftBalance: user.giftBalance ?? 0,
        favorites: user.favorites || [],
        joinDate: user.joinDate || '',
        isRegistered: !!user.isRegistered,
        deviceId: user.deviceId || ''
      }).then(({ error }) => {
        if (error) handleSupabaseError(error, 'users', 'save');
      });
    } else {
      setDoc(doc(db, COLLECTIONS.USERS, user.id), user).catch(e => {
        console.error("Firestore user save error:", e);
        handleFirestoreError(e, OperationType.WRITE, COLLECTIONS.USERS);
      });
    }
  }

  static async ensureUserInSupabase(userId: string): Promise<void> {
    if (!isSupabaseConfigured() || !userId) return;
    try {
      const active = this.getUser();
      const allUsers = this.getAllUsers();
      const user = allUsers.find(u => u.id === userId) || (userId === active.id ? active : null);
      if (user) {
        await supabase!.from('users').upsert({
          id: user.id,
          name: user.name,
          phone: user.phone,
          address: user.address,
          currency: user.currency,
          balance: user.balance,
          giftBalance: user.giftBalance ?? 0,
          favorites: user.favorites || [],
          joinDate: user.joinDate || '',
          isRegistered: !!user.isRegistered,
          deviceId: user.deviceId || ''
        });
      }
    } catch (e) {
      console.error("Error ensuring user exists in Supabase:", e);
    }
  }

  static async checkIsDeviceBlocked(phone: string, currentDeviceId: string): Promise<boolean> {
    if (!phone || !currentDeviceId) return false;
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase!
          .from('users')
          .select('*')
          .eq('phone', phone)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          const existingUser = data as User;
          if (existingUser.deviceId && existingUser.deviceId !== currentDeviceId) {
            return true; // Another device is registered
          }
        }
      } else {
        const q = query(collection(db, COLLECTIONS.USERS), where("phone", "==", phone));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const existingUser = querySnapshot.docs[0].data() as User;
          if (existingUser.deviceId && existingUser.deviceId !== currentDeviceId) {
            return true; // Another device is registered
          }
        }
      }
    } catch (e) {
      console.warn("Failed to check device block, ignoring for offline compatibility:", e);
    }
    return false;
  }

  static async checkPendingUnlockRequest(phone: string, currentDeviceId: string): Promise<boolean> {
    if (!phone || !currentDeviceId) return false;
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase!
          .from('phone_requests')
          .select('*')
          .eq('oldPhone', phone)
          .eq('type', 'device_unlock')
          .eq('status', 'pending');
        if (error) throw error;
        return data && data.length > 0;
      } else {
        const q = query(
          collection(db, COLLECTIONS.PHONE_REQUESTS),
          where("oldPhone", "==", phone),
          where("type", "==", "device_unlock"),
          where("status", "==", "pending")
        );
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
      }
    } catch (e) {
      console.warn("Failed to check pending device unlock requests:", e);
    }
    return false;
  }

  static getAllUsers(): User[] {
    // In local mode, we return a simulated list of users
    const active = this.getUser();
    const mockUsers: User[] = [
      active,
      { id: 'U1', name: 'منى الأهدل', phone: '771234567', address: 'صنعاء - الحصبة', currency: 'YER_NEW', balance: 0, giftBalance: 0, favorites: [], joinDate: '2026-01' },
      { id: 'U2', name: 'أروى الصبري', phone: '733987654', address: 'تعز - شارع جمال', currency: 'YER_OLD', balance: 0, giftBalance: 0, favorites: [], joinDate: '2026-02' },
      { id: 'U3', name: 'فاطمة الكبسي', phone: '711555666', address: 'عدن - المنصورة', currency: 'SAR', balance: 0, giftBalance: 0, favorites: [], joinDate: '2026-03' },
      { id: 'U4', name: 'بلقيس العبسي', phone: '770999888', address: 'صنعاء - السبعين', currency: 'YER_NEW', balance: 0, giftBalance: 0, favorites: [], joinDate: '2026-04' }
    ];
    // Return mock database users merged with the active user's storage
    const storedList = loadFromStorage<User[]>('amrwh_all_users_list', mockUsers);
    const index = storedList.findIndex(u => u.id === active.id);
    if (index >= 0) {
      storedList[index] = active;
    } else {
      storedList.unshift(active);
    }
    saveToStorage('amrwh_all_users_list', storedList);
    return storedList;
  }

  static deleteUser(userId: string): void {
    const allUsers = loadFromStorage<User[]>('amrwh_all_users_list', []);
    const filtered = allUsers.filter(u => u.id !== userId);
    saveToStorage('amrwh_all_users_list', filtered);
    this.syncEventToGoogleScript('deleteUser', { userId });
    if (isSupabaseConfigured()) {
      supabase!.from('users').delete().eq('id', userId).then(({ error }) => {
        if (error) console.error("Supabase user delete error:", error);
      });
    } else {
      deleteDoc(doc(db, COLLECTIONS.USERS, userId)).catch(e => {
        console.error("Firestore user delete error:", e);
      });
    }
  }

  static updateUserBalanceInList(userId: string, balance: number) {
    const users = this.getAllUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      user.balance = balance;
      if (userId === this.getUser().id) {
        const active = this.getUser();
        active.balance = balance;
        saveToStorage(this.KEYS.USER, active);
      }
      saveToStorage('amrwh_all_users_list', users);
      if (isSupabaseConfigured()) {
        supabase!.from('users').update({ balance }).eq('id', userId).then(({ error }) => {
          if (error) console.error("Supabase user balance update error:", error);
        });
      } else {
        updateDoc(doc(db, COLLECTIONS.USERS, userId), { balance }).catch(e => console.error("Firestore balance save error:", e));
      }
    }
  }

  static updateUserBalances(userId: string, balance: number, giftBalance: number) {
    const users = this.getAllUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      user.balance = balance;
      user.giftBalance = giftBalance;
      if (userId === this.getUser().id) {
        const active = this.getUser();
        active.balance = balance;
        active.giftBalance = giftBalance;
        saveToStorage(this.KEYS.USER, active);
      }
      saveToStorage('amrwh_all_users_list', users);
      if (isSupabaseConfigured()) {
        supabase!.from('users').update({ balance, giftBalance }).eq('id', userId).then(({ error }) => {
          if (error) console.error("Supabase user balances update error:", error);
        });
      } else {
        updateDoc(doc(db, COLLECTIONS.USERS, userId), { balance, giftBalance }).catch(e => console.error("Firestore balances save error:", e));
      }
    }
  }

  // --- CATEGORIES ---
  static getCategories(): Category[] {
    this.initialize();
    const cats = loadFromStorage<Category[]>(this.KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    const prods = this.getProducts();
    // Recalculate product count dynamically
    return cats.map(c => ({
      ...c,
      productCount: prods.filter(p => p.categoryId === c.id).length
    })).sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
  }

  static saveCategory(category: Category): void {
    const cats = this.getCategories();
    const idx = cats.findIndex(c => c.id === category.id);
    if (idx >= 0) {
      cats[idx] = category;
    } else {
      cats.push(category);
    }
    saveToStorage(this.KEYS.CATEGORIES, cats);
    this.syncEventToGoogleScript('saveCategory', { category });
    if (isSupabaseConfigured()) {
      const cleanCategory = {
        id: category.id,
        name: category.name,
        image: category.image || '',
        productCount: category.productCount ?? 0,
        sortOrder: category.sortOrder ?? 0
      };
      supabase!.from('categories').upsert(cleanCategory).then(({ error }) => {
        if (error) {
          handleSupabaseError(error, 'categories', 'save');
        }
      });
    } else {
      setDoc(doc(db, COLLECTIONS.CATEGORIES, category.id), category).catch(e => {
        console.error("Firestore category save error:", e);
        handleFirestoreError(e, OperationType.WRITE, COLLECTIONS.CATEGORIES);
      });
    }
  }

  static deleteCategory(categoryId: string): void {
    const cats = this.getCategories();
    const filtered = cats.filter(c => c.id !== categoryId);
    saveToStorage(this.KEYS.CATEGORIES, filtered);
    this.syncEventToGoogleScript('deleteCategory', { categoryId });
    if (isSupabaseConfigured()) {
      supabase!.from('categories').delete().eq('id', categoryId).then(({ error }) => {
        if (error) handleSupabaseError(error, 'categories', 'delete');
      });
    } else {
      deleteDoc(doc(db, COLLECTIONS.CATEGORIES, categoryId)).catch(e => {
        console.error("Firestore category delete error:", e);
        handleFirestoreError(e, OperationType.DELETE, COLLECTIONS.CATEGORIES);
      });
    }
  }

  // --- DELIVERY LOCATIONS ---
  static getLocations(): DeliveryLocation[] {
    this.initialize();
    return loadFromStorage<DeliveryLocation[]>(this.KEYS.LOCATIONS, DEFAULT_LOCATIONS);
  }

  static saveLocation(location: DeliveryLocation): void {
    const locs = this.getLocations();
    const idx = locs.findIndex(l => l.id === location.id);
    if (idx >= 0) {
      locs[idx] = location;
    } else {
      locs.push(location);
    }
    saveToStorage(this.KEYS.LOCATIONS, locs);
    this.syncEventToGoogleScript('saveLocation', { location });
    if (isSupabaseConfigured()) {
      supabase!.from('locations').upsert(location).then(({ error }) => {
        if (error) handleSupabaseError(error, 'locations', 'save');
      });
    } else {
      setDoc(doc(db, COLLECTIONS.LOCATIONS, location.id), location).catch(e => {
        console.error("Firestore location save error:", e);
        handleFirestoreError(e, OperationType.WRITE, COLLECTIONS.LOCATIONS);
      });
    }
  }

  static deleteLocation(id: string): void {
    const locs = this.getLocations();
    const filtered = locs.filter(l => l.id !== id);
    saveToStorage(this.KEYS.LOCATIONS, filtered);
    this.syncEventToGoogleScript('deleteLocation', { id });
    if (isSupabaseConfigured()) {
      supabase!.from('locations').delete().eq('id', id).then(({ error }) => {
        if (error) handleSupabaseError(error, 'locations', 'delete');
      });
    } else {
      deleteDoc(doc(db, COLLECTIONS.LOCATIONS, id)).catch(e => {
        console.error("Firestore location delete error:", e);
        handleFirestoreError(e, OperationType.DELETE, COLLECTIONS.LOCATIONS);
      });
    }
  }

  // --- PRODUCTS ---
  static getProducts(): Product[] {
    this.initialize();
    return loadFromStorage<Product[]>(this.KEYS.PRODUCTS, DEFAULT_PRODUCTS);
  }

  static saveProduct(product: Product): void {
    const prods = this.getProducts();
    const idx = prods.findIndex(p => p.id === product.id);
    if (idx >= 0) {
      prods[idx] = product;
    } else {
      prods.push(product);
    }
    saveToStorage(this.KEYS.PRODUCTS, prods);
    this.syncEventToGoogleScript('saveProduct', { product });
    if (isSupabaseConfigured()) {
      const cleanProduct = {
        id: product.id,
        code: product.code || '',
        name: product.name || '',
        categoryId: product.categoryId || '',
        categoryName: product.categoryName || '',
        subCategoryIds: product.subCategoryIds || [],
        description: product.description || '',
        priceYERNew: product.priceYERNew ?? 0,
        images: product.images || [],
        properties: product.properties || [],
        isOnOffer: !!product.isOnOffer,
        offerPriceNew: product.offerPriceNew || null,
        offerOldPrice: product.offerOldPrice || null,
        rating: product.rating ?? 5
      };
      supabase!.from('products').upsert(cleanProduct).then(({ error }) => {
        if (error) handleSupabaseError(error, 'products', 'save');
      });
    } else {
      setDoc(doc(db, COLLECTIONS.PRODUCTS, product.id), product).catch(e => {
        console.error("Firestore product save error:", e);
        handleFirestoreError(e, OperationType.WRITE, COLLECTIONS.PRODUCTS);
      });
    }
  }

  static deleteProduct(productId: string): void {
    const prods = this.getProducts();
    const filtered = prods.filter(p => p.id !== productId);
    saveToStorage(this.KEYS.PRODUCTS, filtered);
    this.syncEventToGoogleScript('deleteProduct', { productId });
    if (isSupabaseConfigured()) {
      supabase!.from('products').delete().eq('id', productId).then(({ error }) => {
        if (error) handleSupabaseError(error, 'products', 'delete');
      });
    } else {
      deleteDoc(doc(db, COLLECTIONS.PRODUCTS, productId)).catch(e => {
        console.error("Firestore product delete error:", e);
        handleFirestoreError(e, OperationType.DELETE, COLLECTIONS.PRODUCTS);
      });
    }
  }

  // --- EXCHANGE RATES ---
  static getExchangeRate(): ExchangeRate {
    this.initialize();
    return loadFromStorage<ExchangeRate>(this.KEYS.EXCHANGE_RATE, DEFAULT_EXCHANGE_RATE);
  }

  static saveExchangeRate(rate: ExchangeRate): void {
    saveToStorage(this.KEYS.EXCHANGE_RATE, rate);
    this.syncEventToGoogleScript('saveExchangeRate', { rate });
    if (isSupabaseConfigured()) {
      supabase!.from('settings').upsert({ id: 'general', data: { exchangeRate: rate, offers: this.getOffersImages() } }).then(({ error }) => {
        if (error) console.error("Supabase exchangeRate save error:", error);
      });
    } else {
      setDoc(doc(db, COLLECTIONS.SETTINGS, 'general'), { exchangeRate: rate }, { merge: true }).catch(e => console.error("Firestore exchangeRate save error:", e));
    }
  }

  // --- ADVISOR & ADMIN SETTINGS ---
  static getAdvisorSettings(): AdvisorSettings {
    this.initialize();
    return loadFromStorage<AdvisorSettings>(this.KEYS.ADVISOR, DEFAULT_ADVISOR_SETTINGS);
  }

  static saveAdvisorSettings(settings: AdvisorSettings): void {
    saveToStorage(this.KEYS.ADVISOR, settings);
    this.syncEventToGoogleScript('saveAdvisorSettings', { settings });
    if (isSupabaseConfigured()) {
      supabase!.from('settings').upsert({ id: 'advisor', data: settings }).then(({ error }) => {
        if (error) console.error("Supabase advisor save error:", error);
      });
    } else {
      setDoc(doc(db, COLLECTIONS.SETTINGS, 'advisor'), settings).catch(e => console.error("Firestore advisor save error:", e));
    }
  }

  static getAdminSettings(): AdminSettings {
    this.initialize();
    return loadFromStorage<AdminSettings>(this.KEYS.ADMIN, DEFAULT_ADMIN_SETTINGS);
  }

  static getWorkerCode(): string {
    const settings = this.getAdminSettings();
    return settings.workerCode || '1111';
  }

  static saveAdminSettings(settings: AdminSettings): void {
    saveToStorage(this.KEYS.ADMIN, settings);
    this.syncEventToGoogleScript('saveAdminSettings', { settings });
    if (isSupabaseConfigured()) {
      supabase!.from('settings').upsert({ id: 'admin', data: settings }).then(({ error }) => {
        if (error) console.error("Supabase admin settings save error:", error);
      });
    } else {
      setDoc(doc(db, COLLECTIONS.SETTINGS, 'admin'), settings).catch(e => console.error("Firestore admin settings save error:", e));
    }
  }

  // --- OFFERS SLIDER ---
  static getOffersImages(): string[] {
    this.initialize();
    return loadFromStorage<string[]>(this.KEYS.OFFERS, DEFAULT_OFFERS_IMAGES);
  }

  static saveOffersImages(images: string[]): void {
    saveToStorage(this.KEYS.OFFERS, images);
    this.syncEventToGoogleScript('saveOffersImages', { images });
    if (isSupabaseConfigured()) {
      supabase!.from('settings').upsert({ id: 'general', data: { exchangeRate: this.getExchangeRate(), offers: images } }).then(({ error }) => {
        if (error) console.error("Supabase offers save error:", error);
      });
    } else {
      setDoc(doc(db, COLLECTIONS.SETTINGS, 'general'), { offers: images }, { merge: true }).catch(e => console.error("Firestore offers save error:", e));
    }
  }

  // --- NEWS TICKER TEXTS ---
  static getTickerTexts(): string[] {
    this.initialize();
    const texts = loadFromStorage<string[]>(this.KEYS.TICKER_TEXTS, []);
    if (!texts || texts.length === 0) {
      return [
        'مرحباً بكم في متجر أم روح 🌸 منصتكم الأولى للتسوق للأسر المنتجة باليمن!',
        'توصيل سريع ومضمون لكافة المحافظات اليمنية 🚚',
        'خصومات وعروض مميزة مستمرة على كافة الأقسام 🌟'
      ];
    }
    return texts;
  }

  static saveTickerTexts(texts: string[]): void {
    const oldLength = loadFromStorage<string[]>(this.KEYS.TICKER_TEXTS, []).length;
    saveToStorage(this.KEYS.TICKER_TEXTS, texts);
    this.syncEventToGoogleScript('saveTickerTexts', { texts });
    if (isSupabaseConfigured()) {
      supabase!.from('settings').upsert({ id: 'general', data: { exchangeRate: this.getExchangeRate(), offers: this.getOffersImages(), tickerTexts: texts } }).then(undefined, () => {});
      texts.forEach((text, i) => {
        supabase!.from('ticker_texts').upsert({ id: `ticker_${i}`, text, sortOrder: i, createdAt: new Date().toISOString() }).then(undefined, () => {});
      });
      if (oldLength > texts.length) {
        for (let i = texts.length; i < oldLength + 10; i++) {
          supabase!.from('ticker_texts').delete().eq('id', `ticker_${i}`).then(undefined, () => {});
        }
      }
    } else {
      setDoc(doc(db, COLLECTIONS.SETTINGS, 'general'), { tickerTexts: texts }, { merge: true })
        .catch(e => console.error("Firestore ticker texts save error:", e));

      // Save to dedicated ticker_texts collection/table
      try {
        texts.forEach((text, i) => {
          setDoc(doc(db, COLLECTIONS.TICKER_TEXTS, `ticker_${i}`), {
            id: `ticker_${i}`,
            text: text,
            sortOrder: i,
            createdAt: new Date().toISOString()
          }).catch(e => console.error("Error saving ticker doc:", e));
        });
        // Delete leftovers if list became smaller
        if (oldLength > texts.length) {
          for (let i = texts.length; i < oldLength + 10; i++) {
            deleteDoc(doc(db, COLLECTIONS.TICKER_TEXTS, `ticker_${i}`)).catch(() => {});
          }
        }
      } catch (e) {
        console.error("Firestore dedicated ticker collection write error:", e);
      }
    }
  }

  // --- GIFTS (UM ROUH GIFTS) ---
  static getGifts(): Gift[] {
    this.initialize();
    return loadFromStorage<Gift[]>(this.KEYS.GIFTS, []);
  }

  static sendGift(userId: string, userName: string, userPhone: string, amount: number): void {
    const gifts = this.getGifts();
    const newGift: Gift = {
      id: 'GIFT_' + Date.now(),
      userId,
      userName,
      userPhone,
      amount,
      createdAt: new Date().toISOString(),
    };
    gifts.push(newGift);
    saveToStorage(this.KEYS.GIFTS, gifts);
    if (isSupabaseConfigured()) {
      this.ensureUserInSupabase(newGift.userId).then(() => {
        supabase!.from('gifts').insert(newGift).then(({ error }) => {
          if (error) console.error("Supabase gift send error:", error);
        });
      });
    } else {
      setDoc(doc(db, COLLECTIONS.GIFTS, newGift.id), newGift).catch(e => console.error("Firestore gift send error:", e));
    }

    // Update user's balance
    const activeUser = this.getUser();
    if (activeUser.id === userId) {
      activeUser.giftBalance = (activeUser.giftBalance || 0) + amount;
      this.saveUser(activeUser);
    }
    const target = this.getAllUsers().find(u => u.id === userId);
    if (target) {
      const currentGift = target.giftBalance || 0;
      this.updateUserBalances(userId, target.balance, currentGift + amount);
    }

    // Trigger notification
    this.addNotification({
      id: 'NOTIF_' + Date.now(),
      userId,
      title: 'رصيد هدية جديد من أم روح 🎁',
      message: `لقد تم منحك هدية رصيد بقيمة ${amount} ريال يمني جديد في حسابك للاستخدام كخيار سداد مباشر في سلتك! شكراً لوفائك وثقتك بمتجرنا 🌸.`,
      createdAt: new Date().toISOString(),
      isRead: false
    });
  }

  // --- RECHARGE REQUESTS ---
  static getRechargeRequests(): RechargeRequest[] {
    this.initialize();
    return loadFromStorage<RechargeRequest[]>(this.KEYS.RECHARGES, []);
  }

  static submitRechargeRequest(req: Omit<RechargeRequest, 'id' | 'createdAt' | 'status'>): void {
    const list = this.getRechargeRequests();
    const newReq: RechargeRequest = {
      ...req,
      id: 'RECH_' + Date.now(),
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    list.push(newReq);
    saveToStorage(this.KEYS.RECHARGES, list);
    if (isSupabaseConfigured()) {
      this.ensureUserInSupabase(newReq.userId).then(() => {
        supabase!.from('recharges').insert(newReq).then(({ error }) => {
          if (error) console.error("Supabase recharge submit error:", error);
        });
      });
    } else {
      setDoc(doc(db, COLLECTIONS.RECHARGES, newReq.id), newReq).catch(e => {
        console.error("Firestore recharge submit error:", e);
        handleFirestoreError(e, OperationType.WRITE, COLLECTIONS.RECHARGES);
      });
    }

    // Send successful submission notification
    this.addNotification({
      id: 'NOTIF_' + Date.now() + '_recharge',
      userId: req.userId,
      title: 'تم إرسال طلب الشحن بنجاح 💳',
      message: `تم إرسال طلب شحن رصيدكِ بقيمة ${req.amount} ريال يمني جديد للإدارة للتحقق والموافقة بنجاح! وسوف يتم إشعاركِ بمجرد معالجة الرصيد 🌸.`,
      createdAt: new Date().toISOString(),
      isRead: false
    });
  }

  static approveRechargeRequest(id: string, approvedAmount: number): void {
    const list = this.getRechargeRequests();
    const req = list.find(r => r.id === id);
    if (req && req.status === 'pending') {
      req.status = 'approved';
      req.amount = approvedAmount; // Admin can specify approved amount
      saveToStorage(this.KEYS.RECHARGES, list);
      if (isSupabaseConfigured()) {
        supabase!.from('recharges').update({ status: 'approved', amount: approvedAmount }).eq('id', id).then(({ error }) => {
          if (error) console.error("Supabase recharge approve error:", error);
        });
      } else {
        updateDoc(doc(db, COLLECTIONS.RECHARGES, id), { status: 'approved', amount: approvedAmount }).catch(e => {
          console.error("Firestore recharge approve error:", e);
          handleFirestoreError(e, OperationType.UPDATE, COLLECTIONS.RECHARGES);
        });
      }

      // Add to user balance
      const activeUser = this.getUser();
      if (activeUser.id === req.userId) {
        activeUser.balance += approvedAmount;
        this.saveUser(activeUser);
      }
      const target = this.getAllUsers().find(u => u.id === req.userId);
      if (target) {
        const currentGift = target.giftBalance || 0;
        this.updateUserBalances(req.userId, target.balance + approvedAmount, currentGift);
      }

      // Notification
      this.addNotification({
        id: 'NOTIF_' + Date.now(),
        userId: req.userId,
        title: 'تمت الموافقة على شحن رصيدك ✅',
        message: `تم التحقق من الحوالة وإيداع مبلغ ${approvedAmount} ريال يمني جديد في حسابك بنجاح. رصيدك الحالي جاهز للتسوق الآن.`,
        createdAt: new Date().toISOString(),
        isRead: false
      });
    }
  }

  static rejectRechargeRequest(id: string): void {
    const list = this.getRechargeRequests();
    const req = list.find(r => r.id === id);
    if (req && req.status === 'pending') {
      req.status = 'rejected';
      saveToStorage(this.KEYS.RECHARGES, list);
      if (isSupabaseConfigured()) {
        supabase!.from('recharges').update({ status: 'rejected' }).eq('id', id).then(({ error }) => {
          if (error) console.error("Supabase recharge reject error:", error);
        });
      } else {
        updateDoc(doc(db, COLLECTIONS.RECHARGES, id), { status: 'rejected' }).catch(e => {
          console.error("Firestore recharge reject error:", e);
          handleFirestoreError(e, OperationType.UPDATE, COLLECTIONS.RECHARGES);
        });
      }

      // Notification
      this.addNotification({
        id: 'NOTIF_' + Date.now(),
        userId: req.userId,
        title: 'تنبيه: تعذر شحن الرصيد ⚠️',
        message: 'عذراً، لم نتمكن من تأكيد حوالتك المالية المرفقة لشحن الرصيد. يرجى مراجعة بيانات الإيداع أو صورة الإثبات والمحاولة مرة أخرى، أو التواصل مع مستشارتنا روح.',
        createdAt: new Date().toISOString(),
        isRead: false
      });
    }
  }

  // --- PHONE CHANGE REQUESTS ---
  static getPhoneRequests(): PhoneChangeRequest[] {
    this.initialize();
    return loadFromStorage<PhoneChangeRequest[]>(this.KEYS.PHONE_REQUESTS, []);
  }

  static submitPhoneRequest(userId: string, userName: string, oldPhone: string, newPhone: string, newName?: string): void {
    const list = this.getPhoneRequests();
    const newReq: PhoneChangeRequest = {
      id: 'PHREQ_' + Date.now(),
      userId,
      userName,
      oldPhone,
      newPhone,
      newName,
      createdAt: new Date().toISOString(),
      status: 'pending',
      type: 'change_phone'
    };
    list.push(newReq);
    saveToStorage(this.KEYS.PHONE_REQUESTS, list);
    if (isSupabaseConfigured()) {
      this.ensureUserInSupabase(newReq.userId).then(() => {
        supabase!.from('phone_requests').insert(newReq).then(({ error }) => {
          if (error) console.error("Supabase phone request submit error:", error);
        });
      });
    } else {
      setDoc(doc(db, COLLECTIONS.PHONE_REQUESTS, newReq.id), newReq).catch(e => console.error("Firestore phone request submit error:", e));
    }
  }

  static submitDeviceUnlockRequest(userId: string, userName: string, phone: string, deviceId: string): void {
    const list = this.getPhoneRequests();
    const newReq: PhoneChangeRequest = {
      id: 'PHREQ_' + Date.now(),
      userId,
      userName,
      oldPhone: phone,
      newPhone: phone,
      createdAt: new Date().toISOString(),
      status: 'pending',
      type: 'device_unlock',
      newDeviceId: deviceId
    };
    list.push(newReq);
    saveToStorage(this.KEYS.PHONE_REQUESTS, list);
    if (isSupabaseConfigured()) {
      this.ensureUserInSupabase(newReq.userId).then(() => {
        supabase!.from('phone_requests').insert(newReq).then(({ error }) => {
          if (error) console.error("Supabase device unlock submit error:", error);
        });
      });
    } else {
      setDoc(doc(db, COLLECTIONS.PHONE_REQUESTS, newReq.id), newReq).catch(e => console.error("Firestore device unlock submit error:", e));
    }
  }

  static approvePhoneRequest(id: string): void {
    const list = this.getPhoneRequests();
    const req = list.find(r => r.id === id);
    if (req && req.status === 'pending') {
      req.status = 'approved';
      saveToStorage(this.KEYS.PHONE_REQUESTS, list);
      if (isSupabaseConfigured()) {
        supabase!.from('phone_requests').update({ status: 'approved' }).eq('id', id).then(({ error }) => {
          if (error) console.error("Supabase phone request approve error:", error);
        });
      } else {
        updateDoc(doc(db, COLLECTIONS.PHONE_REQUESTS, id), { status: 'approved' }).catch(e => console.error("Firestore phone request approve error:", e));
      }

      if (req.type === 'device_unlock' && req.newDeviceId) {
        // Update device binding
        const activeUser = this.getUser();
        if (activeUser.id === req.userId || activeUser.phone === req.oldPhone) {
          activeUser.deviceId = req.newDeviceId;
          this.saveUser(activeUser);
        }

        const allUsers = this.getAllUsers();
        const dbUser = allUsers.find(u => u.phone === req.oldPhone || u.id === req.userId);
        if (dbUser) {
          dbUser.deviceId = req.newDeviceId;
          saveToStorage('amrwh_all_users_list', allUsers);
          if (isSupabaseConfigured()) {
            supabase!.from('users').update({ deviceId: req.newDeviceId }).eq('id', dbUser.id).then(undefined, () => {});
          } else {
            updateDoc(doc(db, COLLECTIONS.USERS, dbUser.id), { deviceId: req.newDeviceId }).catch(e => console.error("Firestore user device update error:", e));
          }
        }

        // Notification for device unlock
        this.addNotification({
          id: 'NOTIF_' + Date.now(),
          userId: req.userId,
          title: 'تم ربط جهازكِ الجديد بنجاح 🔓',
          message: `تمت الموافقة من الإدارة على ربط جهازكِ الجديد بالرقم: ${req.oldPhone}. يمكنكِ الآن استخدام التطبيق بالكامل!`,
          createdAt: new Date().toISOString(),
          isRead: false
        });
      } else {
        // Update actual user's phone and name
        const activeUser = this.getUser();
        if (activeUser.id === req.userId) {
          activeUser.phone = req.newPhone;
          if (req.newName) activeUser.name = req.newName;
          this.saveUser(activeUser);
        }
        
        const allUsers = this.getAllUsers();
        const dbUser = allUsers.find(u => u.id === req.userId);
        if (dbUser) {
          dbUser.phone = req.newPhone;
          if (req.newName) dbUser.name = req.newName;
          saveToStorage('amrwh_all_users_list', allUsers);
          if (isSupabaseConfigured()) {
            supabase!.from('users').update({ phone: req.newPhone, ...(req.newName ? { name: req.newName } : {}) }).eq('id', req.userId).then(undefined, () => {});
          } else {
            updateDoc(doc(db, COLLECTIONS.USERS, req.userId), { 
              phone: req.newPhone,
              ...(req.newName ? { name: req.newName } : {})
            }).catch(e => console.error("Firestore user phone update error:", e));
          }
        }

        // Notification
        this.addNotification({
          id: 'NOTIF_' + Date.now(),
          userId: req.userId,
          title: 'تم تحديث بيانات ملفكِ الشخصي بنجاح 📱',
          message: `تمت الموافقة وتغيير بيانات حسابكِ المسجل بنجاح (الاسم: ${req.newName || req.userName} | رقم الهاتف: ${req.newPhone}). شكراً لثقتكِ بنا! 🥰`,
          createdAt: new Date().toISOString(),
          isRead: false
        });
      }
    }
  }

  static rejectPhoneRequest(id: string): void {
    const list = this.getPhoneRequests();
    const req = list.find(r => r.id === id);
    if (req && req.status === 'pending') {
      req.status = 'rejected';
      saveToStorage(this.KEYS.PHONE_REQUESTS, list);
      if (isSupabaseConfigured()) {
        supabase!.from('phone_requests').update({ status: 'rejected' }).eq('id', id).then(({ error }) => {
          if (error) console.error("Supabase phone request reject error:", error);
        });
      } else {
        updateDoc(doc(db, COLLECTIONS.PHONE_REQUESTS, id), { status: 'rejected' }).catch(e => console.error("Firestore phone request reject error:", e));
      }

      // Notification
      this.addNotification({
        id: 'NOTIF_' + Date.now(),
        userId: req.userId,
        title: 'تنبيه: تم رفض طلب تعديل البيانات ⚠️',
        message: 'عذراً، تعذر على الإدارة الموافقة على طلب تعديل الاسم أو رقم الهاتف الخاص بكِ لمخالفته معايير التحقق والتأمين بالمنصة. يرجى مراجعة البيانات المدخلة أو التواصل مع مستشارتنا روح.',
        createdAt: new Date().toISOString(),
        isRead: false
      });
    }
  }

  // --- ORDERS ---
  static getOrders(): Order[] {
    this.initialize();
    return loadFromStorage<Order[]>(this.KEYS.ORDERS, []);
  }

  static saveOrder(order: Order): void {
    const list = this.getOrders();
    const idx = list.findIndex(o => o.id === order.id);
    if (idx >= 0) {
      list[idx] = order;
    } else {
      list.push(order);
    }
    saveToStorage(this.KEYS.ORDERS, list);
    
    if (this.isBackupMode()) {
      this.fetchFromGoogleScript('createOrder', { order }).then(res => {
        if (res.success) {
          console.log("Order saved to Google Sheets successfully.");
        } else {
          console.warn("Failed to save order to Google Sheets:", res.error);
        }
      });
    }

    if (isSupabaseConfigured()) {
      this.ensureUserInSupabase(order.userId).then(() => {
        supabase!.from('orders').upsert(order).then(({ error }) => {
          if (error) {
            console.error("Supabase order save error, falling back to Google Sheets:", error);
            this.fetchFromGoogleScript('createOrder', { order });
          }
        });
      });
    } else {
      setDoc(doc(db, COLLECTIONS.ORDERS, order.id), order).catch(e => {
        console.error("Firestore order save error, falling back to Google Sheets:", e);
        this.fetchFromGoogleScript('createOrder', { order });
      });
    }
  }

  static updateOrderStatus(id: string, status: 'completed' | 'canceled'): void {
    const list = this.getOrders();
    const order = list.find(o => o.id === id);
    if (order) {
      order.status = status;
      saveToStorage(this.KEYS.ORDERS, list);
      this.syncEventToGoogleScript('updateOrderStatus', { id, status });
      if (isSupabaseConfigured()) {
        supabase!.from('orders').update({ status }).eq('id', id).then(({ error }) => {
          if (error) console.error("Supabase order update error:", error);
        });
      } else {
        updateDoc(doc(db, COLLECTIONS.ORDERS, id), { status }).catch(e => console.error("Firestore order update error:", e));
      }

      // Send appropriate notification
      if (status === 'completed') {
        // Notification 1: Acceptance of new order
        this.addNotification({
          id: 'NOTIF_ACCEPT_' + id + '_' + Date.now(),
          userId: order.userId,
          title: 'تم قبول وتأكيد طلبكِ بنجاح 👍🌸',
          message: `تمت مراجعة وقبول طلبكِ المميّز ذو الرقم المرجعي (${order.id}) بنجاح من قبل الإدارة وسداد قيمته، ويجري الآن تجهيز طلبيتكِ بكل دقة وحب!`,
          createdAt: new Date().toISOString(),
          isRead: false
        });

        // Notification 2: Conversion to received/shipped order (cheerful, in transit)
        this.addNotification({
          id: 'NOTIF_SHIP_' + id + '_' + Date.now(),
          userId: order.userId,
          title: 'طلبكِ الرائع في الطريق إليكِ! 🚚🎉',
          message: `مبارك لكِ يا عزيزتي! 😍✨ طلبكِ المميّز ذو الرقم المرجعي (${order.id}) قد انطلق الآن وهو في طريقهِ السريع إليكِ بابتهاج وسرور! استعدي لاستلامه وتزيّني وتدلّلي به دائماً مع أم روح 🌸🥳`,
          createdAt: new Date(Date.now() + 1000).toISOString(), // slightly newer timestamp so it sorts on top
          isRead: false
        });
      } else {
        // Canceled notification
        this.addNotification({
          id: 'NOTIF_' + Date.now(),
          userId: order.userId,
          title: 'تنبيه: تم إلغاء الطلب ❌',
          message: `لقد تم إلغاء طلبك ذو الرقم المرجعي (${order.id}). إذا كنتِ تعتقدين أن هناك خطأ أو لمزيد من الاستفسار يرجى الاتصال بمستشارتنا روح 🌸.`,
          createdAt: new Date().toISOString(),
          isRead: false
        });
      }
    }
  }

  // --- NOTIFICATIONS ---
  static getNotifications(userId: string): Notification[] {
    this.initialize();
    const list = loadFromStorage<Notification[]>(this.KEYS.NOTIFICATIONS, DEFAULT_NOTIFICATIONS);
    // Return notifications that are either public (no userId) or specific to this user
    return list.filter(n => !n.userId || n.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static addNotification(notif: Notification): void {
    const list = loadFromStorage<Notification[]>(this.KEYS.NOTIFICATIONS, DEFAULT_NOTIFICATIONS);
    list.push(notif);
    saveToStorage(this.KEYS.NOTIFICATIONS, list);
    if (isSupabaseConfigured()) {
      const cleanNotif = {
        id: notif.id,
        userId: notif.userId || null,
        title: notif.title || '',
        message: notif.message || '',
        createdAt: notif.createdAt || '',
        isRead: !!notif.isRead,
        image: notif.image || null,
        productId: notif.productId || null
      };
      const proceedInsert = () => {
        supabase!.from('notifications').insert(cleanNotif).then(({ error }) => {
          if (error) console.error("Supabase notification save error:", error);
        });
      };
      if (cleanNotif.userId) {
        this.ensureUserInSupabase(cleanNotif.userId).then(proceedInsert);
      } else {
        proceedInsert();
      }
    } else {
      setDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notif.id), notif).catch(e => console.error("Firestore notification save error:", e));
    }

    // Dispatch custom event to let React show in-app toasts & browser push notifications
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('new-notification-alert', { detail: notif });
      window.dispatchEvent(event);
    }
  }

  static markAllNotificationsRead(userId: string): void {
    const list = loadFromStorage<Notification[]>(this.KEYS.NOTIFICATIONS, DEFAULT_NOTIFICATIONS);
    list.forEach(n => {
      if (!n.userId || n.userId === userId) {
        n.isRead = true;
        if (isSupabaseConfigured()) {
          supabase!.from('notifications').update({ isRead: true }).eq('id', n.id).then(undefined, () => {});
        } else {
          updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, n.id), { isRead: true }).catch(e => {});
        }
      }
    });
    saveToStorage(this.KEYS.NOTIFICATIONS, list);
  }

  // --- TARGETED NOTIFICATIONS & GIFTS ---
  static getTargetedNotifications(): TargetedNotification[] {
    this.initialize();
    return loadFromStorage<TargetedNotification[]>(this.KEYS.TARGETED_NOTIFICATIONS, []);
  }

  static saveTargetedNotification(notif: TargetedNotification): void {
    const list = this.getTargetedNotifications();
    const idx = list.findIndex(n => n.id === notif.id);
    if (idx >= 0) {
      list[idx] = notif;
    } else {
      list.push(notif);
    }
    saveToStorage(this.KEYS.TARGETED_NOTIFICATIONS, list);
    this.syncEventToGoogleScript('saveTargetedNotification', { notif });
    if (isSupabaseConfigured()) {
      supabase!.from('targeted_notifications').upsert(notif).then(({ error }) => {
        if (error) console.error("Supabase targeted notification save error:", error);
      });
    } else {
      setDoc(doc(db, COLLECTIONS.TARGETED_NOTIFICATIONS, notif.id), notif).catch(e => console.error("Firestore targeted notification save error:", e));
    }
  }

  static deleteTargetedNotification(id: string): void {
    const list = this.getTargetedNotifications();
    const filtered = list.filter(n => n.id !== id);
    saveToStorage(this.KEYS.TARGETED_NOTIFICATIONS, filtered);
    this.syncEventToGoogleScript('deleteTargetedNotification', { id });
    if (isSupabaseConfigured()) {
      supabase!.from('targeted_notifications').delete().eq('id', id).then(({ error }) => {
        if (error) console.error("Supabase targeted notification delete error:", error);
      });
    } else {
      deleteDoc(doc(db, COLLECTIONS.TARGETED_NOTIFICATIONS, id)).catch(e => console.error("Firestore targeted notification delete error:", e));
    }
  }

  static getTargetedGifts(): TargetedGift[] {
    this.initialize();
    return loadFromStorage<TargetedGift[]>(this.KEYS.TARGETED_GIFTS, []);
  }

  static saveTargetedGift(gift: TargetedGift): void {
    const list = this.getTargetedGifts();
    const idx = list.findIndex(g => g.id === gift.id);
    if (idx >= 0) {
      list[idx] = gift;
    } else {
      list.push(gift);
    }
    saveToStorage(this.KEYS.TARGETED_GIFTS, list);
    this.syncEventToGoogleScript('saveTargetedGift', { gift });
    if (isSupabaseConfigured()) {
      supabase!.from('targeted_gifts').upsert(gift).then(({ error }) => {
        if (error) console.error("Supabase targeted gift save error:", error);
      });
    } else {
      setDoc(doc(db, COLLECTIONS.TARGETED_GIFTS, gift.id), gift).catch(e => console.error("Firestore targeted gift save error:", e));
    }
  }

  static deleteTargetedGift(id: string): void {
    const list = this.getTargetedGifts();
    const filtered = list.filter(g => g.id !== id);
    saveToStorage(this.KEYS.TARGETED_GIFTS, filtered);
    this.syncEventToGoogleScript('deleteTargetedGift', { id });
    if (isSupabaseConfigured()) {
      supabase!.from('targeted_gifts').delete().eq('id', id).then(({ error }) => {
        if (error) console.error("Supabase targeted gift delete error:", error);
      });
    } else {
      deleteDoc(doc(db, COLLECTIONS.TARGETED_GIFTS, id)).catch(e => console.error("Firestore targeted gift delete error:", e));
    }
  }

  static getUserTargetedGiftLogs(): UserTargetedGiftLog[] {
    this.initialize();
    return loadFromStorage<UserTargetedGiftLog[]>(this.KEYS.TARGETED_GIFT_LOGS, []);
  }

  static saveUserTargetedGiftLog(log: UserTargetedGiftLog): void {
    const list = this.getUserTargetedGiftLogs();
    const idx = list.findIndex(l => l.id === log.id);
    if (idx >= 0) {
      list[idx] = log;
    } else {
      list.push(log);
    }
    saveToStorage(this.KEYS.TARGETED_GIFT_LOGS, list);
    this.syncEventToGoogleScript('saveUserTargetedGiftLog', { log });
    if (isSupabaseConfigured()) {
      supabase!.from('targeted_gift_logs').upsert(log).then(({ error }) => {
        if (error) console.error("Supabase user targeted gift log save error:", error);
      });
    } else {
      setDoc(doc(db, COLLECTIONS.TARGETED_GIFT_LOGS, log.id), log).catch(e => console.error("Firestore user targeted gift log save error:", e));
    }
  }

  static toggleProductFavorite(userId: string, productId: string): User {
    const active = this.getUser();
    if (active.id === userId) {
      const favorites = active.favorites || [];
      const index = favorites.indexOf(productId);
      if (index >= 0) {
        favorites.splice(index, 1);
      } else {
        favorites.push(productId);
      }
      active.favorites = favorites;
      this.saveUser(active);
      return active;
    } else {
      const allUsers = this.getAllUsers();
      const u = allUsers.find(user => user.id === userId);
      if (u) {
        const favorites = u.favorites || [];
        const index = favorites.indexOf(productId);
        if (index >= 0) {
          favorites.splice(index, 1);
        } else {
          favorites.push(productId);
        }
        u.favorites = favorites;
        saveToStorage('amrwh_all_users_list', allUsers);
        if (isSupabaseConfigured()) {
          supabase!.from('users').update({ favorites }).eq('id', userId).then(undefined, () => {});
        } else {
          setDoc(doc(db, COLLECTIONS.USERS, userId), u).catch(e => {});
        }
        return u;
      }
    }
    return active;
  }

  // --- GLOBAL EXPORT / IMPORT FOR DATABASE (THE BACKUP TOOL) ---
  static exportFullBackup(): string {
    const backup: Record<string, any> = {};
    Object.entries(this.KEYS).forEach(([_, storeKey]) => {
      backup[storeKey] = localStorage.getItem(storeKey);
    });
    backup['amrwh_all_users_list'] = localStorage.getItem('amrwh_all_users_list');
    return JSON.stringify(backup);
  }

  static importFullBackup(jsonStr: string): boolean {
    try {
      const backup = JSON.parse(jsonStr);
      Object.entries(backup).forEach(([storeKey, val]) => {
        if (val !== null) {
          localStorage.setItem(storeKey, val as string);
        }
      });
      return true;
    } catch (e) {
      return false;
    }
  }
}
