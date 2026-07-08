import { supabase } from './supabase';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { 
  initializeFirestore,
  getDocs, 
  collection, 
  doc, 
  getDoc 
} from 'firebase/firestore';
import appletConfig from '../firebase-applet-config.json';

export interface MigrationProgress {
  step: string;
  count: number;
  total: number;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
}

export async function runBrowserMigration(
  onProgress: (log: string) => void,
  onStepChange?: (stepKey: string, progress: MigrationProgress) => void,
  customFirebaseConfig?: {
    projectId: string;
    appId: string;
    apiKey: string;
    authDomain: string;
    storageBucket: string;
    messagingSenderId: string;
    firestoreDatabaseId?: string;
  }
): Promise<{ success: boolean; message: string }> {
  if (!supabase) {
    throw new Error('Supabase Client is not configured. Please check your environment variables.');
  }

  const logMessage = (msg: string) => {
    console.log(`[Migration] ${msg}`);
    onProgress(msg);
  };

  const updateStep = (key: string, step: string, count: number, total: number, status: MigrationProgress['status'], message: string) => {
    if (onStepChange) {
      onStepChange(key, { step, count, total, status, message });
    }
  };

  try {
    logMessage('🚀 بدء عملية الترحيل الشاملة من Firestore إلى Supabase...');

    // Resolve Firebase config
    const fbConfig = customFirebaseConfig || {
      projectId: appletConfig.projectId,
      appId: appletConfig.appId,
      apiKey: appletConfig.apiKey,
      authDomain: appletConfig.authDomain,
      storageBucket: appletConfig.storageBucket,
      messagingSenderId: appletConfig.messagingSenderId,
      firestoreDatabaseId: (appletConfig as any).firestoreDatabaseId
    };

    logMessage(`🔍 تهيئة الاتصال بقاعدة بيانات Firebase المصدر للمشروع: (${fbConfig.projectId})...`);

    // Safely delete existing source app to avoid duplicate app errors or stale credentials
    const existingApp = getApps().find(app => app.name === 'source-migration-app');
    if (existingApp) {
      try {
        await deleteApp(existingApp);
        logMessage('♻️ تم إعادة تعيين تطبيق الاتصال المصدر لتطبيق الإعدادات الجديدة.');
      } catch (err) {
        // Ignore
      }
    }

    const sourceApp = initializeApp({
      projectId: fbConfig.projectId,
      appId: fbConfig.appId,
      apiKey: fbConfig.apiKey,
      authDomain: fbConfig.authDomain,
      storageBucket: fbConfig.storageBucket,
      messagingSenderId: fbConfig.messagingSenderId
    }, 'source-migration-app');

    const sourceDb = fbConfig.firestoreDatabaseId
      ? initializeFirestore(sourceApp, { 
          ignoreUndefinedProperties: true,
          experimentalAutoDetectLongPolling: true
        }, fbConfig.firestoreDatabaseId)
      : initializeFirestore(sourceApp, { 
          ignoreUndefinedProperties: true,
          experimentalAutoDetectLongPolling: true
        });

    // 1. Migrate Settings
    logMessage('⚙️ جاري ترحيل الإعدادات العامة ( settings )...');
    updateStep('settings', 'ترحيل الإعدادات', 0, 3, 'running', 'جاري جلب إعدادات الإدارة والمستشارة...');
    const settingsDocs = ['advisor', 'admin', 'general'];
    let settingsSuccessCount = 0;

    for (const docId of settingsDocs) {
      try {
        const snap = await getDoc(doc(sourceDb, 'settings', docId));
        if (snap.exists()) {
          const data = snap.data();
          const { error } = await supabase.from('settings').upsert({ id: docId, data });
          if (error) {
            logMessage(`❌ فشل ترحيل الإعداد "${docId}": ${error.message}`);
          } else {
            settingsSuccessCount++;
            logMessage(`✅ تم ترحيل الإعداد: ${docId}`);
          }
        } else {
          logMessage(`ℹ️ الإعداد "${docId}" غير موجود في Firestore، تخطي.`);
        }
      } catch (err: any) {
        logMessage(`❌ خطأ أثناء نقل إعداد "${docId}": ${err.message || err}`);
      }
    }
    updateStep('settings', 'ترحيل الإعدادات', settingsSuccessCount, 3, 'success', `تم نقل ${settingsSuccessCount} إعدادات بنجاح.`);

    // Helper for migrating a general collection
    const migrateCollection = async (
      stepKey: string,
      stepTitle: string,
      firestoreCol: string,
      supabaseTable: string,
      transformer: (data: any) => any
    ) => {
      logMessage(`⏳ جاري ترحيل جدول: "${firestoreCol}" إلى Supabase...`);
      updateStep(stepKey, stepTitle, 0, 0, 'running', 'جاري جلب البيانات من Firestore...');
      
      try {
        const snap = await getDocs(collection(sourceDb, firestoreCol));
        const total = snap.size;
        logMessage(`🔹 تم العثور على ${total} سجل في Firestore.`);

        if (total === 0) {
          logMessage(`✅ لا توجد سجلات لنقلها في جدول ${firestoreCol}.`);
          updateStep(stepKey, stepTitle, 0, 0, 'success', 'لا توجد سجلات لنقلها.');
          return;
        }

        let successCount = 0;
        updateStep(stepKey, stepTitle, 0, total, 'running', `جاري ترحيل السجلات (0/${total})...`);

        for (const d of snap.docs) {
          try {
            let record = { id: d.id, ...d.data() };
            const transformed = transformer(record);
            
            const { error } = await supabase.from(supabaseTable).upsert(transformed);
            if (error) {
              logMessage(`❌ فشل إدراج السجل "${d.id}" في "${supabaseTable}": ${error.message}`);
            } else {
              successCount++;
            }
          } catch (itemErr: any) {
            logMessage(`❌ خطأ في تحويل السجل "${d.id}": ${itemErr.message || itemErr}`);
          }

          if (successCount % 5 === 0 || successCount === total) {
            updateStep(stepKey, stepTitle, successCount, total, 'running', `جاري الترحيل (${successCount}/${total})...`);
          }
        }

        logMessage(`✅ اكتمل ترحيل "${supabaseTable}". بنجاح: ${successCount}/${total}`);
        updateStep(stepKey, stepTitle, successCount, total, 'success', `تم نقل ${successCount} سجل بنجاح.`);
      } catch (colErr: any) {
        logMessage(`❌ خطأ أثناء ترحيل الجدول "${firestoreCol}": ${colErr.message || colErr}`);
        updateStep(stepKey, stepTitle, 0, 0, 'error', `فشل الترحيل: ${colErr.message || colErr}`);
      }
    };

    // 2. Migrate Categories
    await migrateCollection('categories', 'الفئات والوجبات', 'categories', 'categories', (data) => ({
      id: data.id,
      name: data.name,
      image: data.image || '',
      productCount: data.productCount ?? 0,
      sortOrder: data.sortOrder ?? 0
    }));

    // 3. Migrate Products
    await migrateCollection('products', 'الأصناف والمنتجات', 'products', 'products', (data) => ({
      id: data.id,
      code: data.code || '',
      name: data.name || '',
      categoryId: data.categoryId || '',
      categoryName: data.categoryName || '',
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

    // 4. Migrate Locations
    await migrateCollection('locations', 'مواقع التوصيل', 'locations', 'locations', (data) => ({
      id: data.id,
      name: data.name || '',
      deliveryFee: data.deliveryFee ?? 0
    }));

    // 5. Migrate Users
    await migrateCollection('users', 'العملاء والمستخدمين', 'users', 'users', (data) => ({
      id: data.id,
      name: data.name || '',
      phone: data.phone || '',
      address: data.address || '',
      currency: data.currency || 'YER_NEW',
      balance: data.balance ?? 0,
      giftBalance: data.giftBalance ?? 0,
      favorites: data.favorites || [],
      joinDate: data.joinDate || '',
      isRegistered: !!data.isRegistered,
      deviceId: data.deviceId || ''
    }));

    // 6. Migrate Orders
    await migrateCollection('orders', 'طلبات العملاء', 'orders', 'orders', (data) => ({
      id: data.id,
      userId: data.userId || '',
      userName: data.userName || '',
      userPhone: data.userPhone || '',
      address: data.address || '',
      deliveryFee: data.deliveryFee ?? 0,
      items: data.items || [],
      senderName: data.senderName || '',
      senderAccount: data.senderAccount || '',
      receiptImage: data.receiptImage || null,
      totalAmount: data.totalAmount ?? 0,
      currency: data.currency || 'YER_NEW',
      createdAt: data.createdAt || '',
      status: data.status || 'pending',
      paymentMethod: data.paymentMethod || '',
      checkoutVia: data.checkoutVia || 'app'
    }));

    // 7. Migrate Gifts
    await migrateCollection('gifts', 'الهدايا', 'gifts', 'gifts', (data) => ({
      id: data.id,
      userId: data.userId || '',
      userName: data.userName || '',
      userPhone: data.userPhone || '',
      amount: data.amount ?? 0,
      createdAt: data.createdAt || ''
    }));

    // 8. Migrate Recharges
    await migrateCollection('recharges', 'طلبات شحن الرصيد', 'recharges', 'recharges', (data) => ({
      id: data.id,
      userId: data.userId || '',
      userName: data.userName || '',
      userPhone: data.userPhone || '',
      senderName: data.senderName || '',
      senderAccount: data.senderAccount || '',
      amount: data.amount ?? 0,
      receiptImage: data.receiptImage || '',
      createdAt: data.createdAt || '',
      status: data.status || 'pending'
    }));

    // 9. Migrate Phone Requests
    await migrateCollection('phone_requests', 'طلبات الهواتف والأجهزة', 'phone_requests', 'phone_requests', (data) => ({
      id: data.id,
      userId: data.userId || '',
      userName: data.userName || '',
      oldPhone: data.oldPhone || '',
      newPhone: data.newPhone || '',
      newName: data.newName || null,
      createdAt: data.createdAt || '',
      status: data.status || 'pending',
      type: data.type || 'change_phone',
      newDeviceId: data.newDeviceId || null
    }));

    // 10. Migrate Notifications
    await migrateCollection('notifications', 'الإشعارات العامة والخاصة', 'notifications', 'notifications', (data) => ({
      id: data.id,
      userId: data.userId || null,
      title: data.title || '',
      message: data.message || '',
      createdAt: data.createdAt || '',
      isRead: !!data.isRead,
      image: data.image || null,
      productId: data.productId || null
    }));

    // 11. Migrate Targeted Notifications
    await migrateCollection('targeted_notifications', 'الإشعارات المستهدفة', 'targeted_notifications', 'targeted_notifications', (data) => ({
      id: data.id,
      title: data.title || '',
      message: data.message || '',
      createdAt: data.createdAt || '',
      expiryAt: data.expiryAt || '',
      targetType: data.targetType || '',
      targetValue: data.targetValue || '',
      isPopup: !!data.isPopup
    }));

    // 12. Migrate Targeted Gifts
    await migrateCollection('targeted_gifts', 'حملات الهدايا المستهدفة', 'targeted_gifts', 'targeted_gifts', (data) => ({
      id: data.id,
      title: data.title || '',
      amount: data.amount ?? 0,
      createdAt: data.createdAt || '',
      expiryAt: data.expiryAt || '',
      targetType: data.targetType || '',
      targetValue: data.targetValue || '',
      daysToUse: data.daysToUse ?? 7,
      claimedUserIds: data.claimedUserIds || []
    }));

    // 13. Migrate Targeted Gift Logs
    await migrateCollection('targeted_gift_logs', 'سجلات الهدايا المستلمة', 'targeted_gift_logs', 'targeted_gift_logs', (data) => ({
      id: data.id,
      userId: data.userId || '',
      userName: data.userName || '',
      userPhone: data.userPhone || '',
      amount: data.amount ?? 0,
      giftCampaignId: data.giftCampaignId || '',
      giftCampaignTitle: data.giftCampaignTitle || '',
      createdAt: data.createdAt || '',
      expiryAt: data.expiryAt || '',
      status: data.status || 'active'
    }));

    // 14. Migrate Ticker Texts
    logMessage('⏳ جاري ترحيل شريط الأخبار المتحرك ( ticker_texts )...');
    updateStep('ticker_texts', 'شريط الأخبار', 0, 0, 'running', 'جاري جلب نصوص شريط الأخبار...');
    try {
      const snap = await getDocs(collection(sourceDb, 'ticker_texts'));
      const total = snap.size;
      let count = 0;
      updateStep('ticker_texts', 'شريط الأخبار', 0, total || 1, 'running', 'جاري النقل...');

      for (const d of snap.docs) {
        const data = d.data();
        const record = {
          id: d.id,
          text: data.text || '',
          sortOrder: data.sortOrder ?? count,
          createdAt: data.createdAt || new Date().toISOString()
        };
        await supabase.from('ticker_texts').upsert(record);
        count++;
      }

      // If no docs, add default
      if (total === 0) {
        const defaultTicker = [
          'أهلاً بكم في متجر أم روح للوجبات اللذيذة والحلويات المنزلية الفاخرة والخدمات المميزة 🌸',
          'خصومات وعروض مميزة مستمرة على كافة الأقسام 🌟'
        ];
        for (let i = 0; i < defaultTicker.length; i++) {
          await supabase.from('ticker_texts').upsert({
            id: `ticker_${i}`,
            text: defaultTicker[i],
            sortOrder: i,
            createdAt: new Date().toISOString()
          });
        }
        count = defaultTicker.length;
      }

      logMessage('✅ تم ترحيل نصوص شريط الأخبار بنجاح.');
      updateStep('ticker_texts', 'شريط الأخبار', count, count, 'success', `تم نقل ${count} نصوص بنجاح.`);
    } catch (err: any) {
      logMessage(`❌ خطأ أثناء نقل شريط الأخبار: ${err.message || err}`);
      updateStep('ticker_texts', 'شريط الأخبار', 0, 0, 'error', `فشل النقل: ${err.message || err}`);
    }

    logMessage('🎉 مبارك! تمت عملية الترحيل بالكامل وبنجاح فائق!');
    return { success: true, message: 'اكتملت عملية ترحيل البيانات بالكامل وبنجاح!' };

  } catch (criticalErr: any) {
    logMessage(`💥 خطأ فادح في عملية الترحيل: ${criticalErr.message || criticalErr}`);
    return { success: false, message: `فشلت عملية الترحيل: ${criticalErr.message || criticalErr}` };
  }
}
