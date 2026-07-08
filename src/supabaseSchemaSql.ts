export const SUPABASE_SCHEMA_SQL = `-- =========================================================================
-- 🌸 سكريبت بناء وهيكلة قاعدة بيانات Supabase لمتجر أم روح (كامل ومترابط) 🌸
-- =========================================================================
-- قومي بنسخ هذا الملف بالكامل ولصقه في قسم (SQL Editor) ثم النقر على (Run) في لوحة Supabase.
-- هذا السكريبت يضمن بناء الجداول، العلاقات، القيود، الفهارس، وسياسات الأمان RLS بشكل تلقائي.

-- ==========================================
-- 1. تهيئة وحذف الجداول القديمة إن وجدت (ترتيب تراجعي لتجنب مشاكل المفاتيح الخارجية)
-- ==========================================
DROP TABLE IF EXISTS targeted_gift_logs CASCADE;
DROP TABLE IF EXISTS targeted_gifts CASCADE;
DROP TABLE IF EXISTS targeted_notifications CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS phone_requests CASCADE;
DROP TABLE IF EXISTS recharges CASCADE;
DROP TABLE IF EXISTS gifts CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS ticker_texts CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- ==========================================
-- 2. بناء الجداول الأساسية غير المعتمدة على غيرها
-- ==========================================

-- أ. جدول الإعدادات العامة للمتجر (Settings)
CREATE TABLE settings (
  id VARCHAR(255) PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ب. شريط الأخبار المتحرك (Ticker Texts)
CREATE TABLE ticker_texts (
  id VARCHAR(255) PRIMARY KEY,
  text TEXT NOT NULL,
  "sortOrder" INT DEFAULT 0,
  "createdAt" VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ج. جدول مواقع التوصيل والأسعار (Delivery Locations)
CREATE TABLE locations (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  "deliveryFee" NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- د. جدول فئات المنتجات (Categories)
CREATE TABLE categories (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  image TEXT NOT NULL, -- لحفظ روابط صور الفئات والأصناف
  "productCount" INT DEFAULT 0,
  "sortOrder" INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- هـ. جدول عملاء ومستخدمي التطبيق (Users)
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(255) NOT NULL UNIQUE,
  address TEXT DEFAULT '',
  currency VARCHAR(50) DEFAULT 'YER_NEW',
  balance NUMERIC DEFAULT 0,
  "giftBalance" NUMERIC DEFAULT 0,
  favorites JSONB DEFAULT '[]'::jsonb, -- لحفظ المنتجات المفضلة لدى المستخدم
  "joinDate" VARCHAR(50),
  "isRegistered" BOOLEAN DEFAULT false,
  "deviceId" VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- و. جدول الإشعارات المستهدفة (Targeted Notifications)
CREATE TABLE targeted_notifications (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  "createdAt" VARCHAR(100) NOT NULL,
  "expiryAt" VARCHAR(100) NOT NULL,
  "targetType" VARCHAR(100) NOT NULL, -- e.g. 'all', 'user', 'device'
  "targetValue" VARCHAR(255) NOT NULL,
  "isPopup" BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ز. جدول حملات الهدايا المستهدفة (Targeted Gifts)
CREATE TABLE targeted_gifts (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  amount NUMERIC NOT NULL,
  "createdAt" VARCHAR(100) NOT NULL,
  "expiryAt" VARCHAR(100) NOT NULL,
  "targetType" VARCHAR(100) NOT NULL,
  "targetValue" VARCHAR(255) NOT NULL,
  "daysToUse" INT DEFAULT 7,
  "claimedUserIds" JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- 3. بناء الجداول التابعة والمرتبطة ببعضها (مع تفعيل الحذف المتتالي CASCADE)
-- ==========================================

-- ح. جدول المنتجات والأصناف (Products) - مرتبط بالفئات
CREATE TABLE products (
  id VARCHAR(255) PRIMARY KEY,
  code VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  "categoryId" VARCHAR(255) NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  "categoryName" VARCHAR(255) NOT NULL,
  "subCategoryIds" JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  "priceYERNew" NUMERIC NOT NULL DEFAULT 0,
  images JSONB DEFAULT '[]'::jsonb, -- لحفظ مصفوفة صور الصنف بالكامل
  properties JSONB DEFAULT '[]'::jsonb,
  "isOnOffer" BOOLEAN DEFAULT false,
  "offerPriceNew" NUMERIC,
  "offerOldPrice" NUMERIC,
  rating NUMERIC DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ط. جدول طلبات الشراء (Orders) - مرتبط بالعملاء
CREATE TABLE orders (
  id VARCHAR(255) PRIMARY KEY,
  "userId" VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "userName" VARCHAR(255) NOT NULL,
  "userPhone" VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  "deliveryFee" NUMERIC DEFAULT 0,
  items JSONB NOT NULL, -- مصفوفة السلة المشتراة وتفاصيل الأصناف وصورها
  "senderName" VARCHAR(255),
  "senderAccount" VARCHAR(255),
  "receiptImage" TEXT, -- رابط صورة سند التحويل البنكي (Base64 أو URL)
  "totalAmount" NUMERIC NOT NULL,
  currency VARCHAR(50) NOT NULL,
  "createdAt" VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  "paymentMethod" VARCHAR(100) NOT NULL,
  "checkoutVia" VARCHAR(100) DEFAULT 'app',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ي. جدول عمليات الهدايا المستلمة (Gifts) - مرتبط بالعملاء
CREATE TABLE gifts (
  id VARCHAR(255) PRIMARY KEY,
  "userId" VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "userName" VARCHAR(255) NOT NULL,
  "userPhone" VARCHAR(255) NOT NULL,
  amount NUMERIC NOT NULL,
  "createdAt" VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ك. جدول طلبات شحن الرصيد (Recharges) - مرتبط بالعملاء
CREATE TABLE recharges (
  id VARCHAR(255) PRIMARY KEY,
  "userId" VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "userName" VARCHAR(255) NOT NULL,
  "userPhone" VARCHAR(255) NOT NULL,
  "senderName" VARCHAR(255),
  "senderAccount" VARCHAR(255),
  amount NUMERIC NOT NULL,
  "receiptImage" TEXT, -- رابط صورة سند الشحن المرفوع
  "createdAt" VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ل. جدول طلبات تعديل الهواتف والأجهزة (Phone and Device Requests) - مرتبط بالعملاء
CREATE TABLE phone_requests (
  id VARCHAR(255) PRIMARY KEY,
  "userId" VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "userName" VARCHAR(255) NOT NULL,
  "oldPhone" VARCHAR(255) NOT NULL,
  "newPhone" VARCHAR(255) NOT NULL,
  "newName" VARCHAR(255),
  "createdAt" VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  type VARCHAR(50) DEFAULT 'change_phone',
  "newDeviceId" VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- م. جدول الإشعارات العامة والخاصة (Notifications) - مرتبط بالعملاء والمنتجات بشكل اختياري
CREATE TABLE notifications (
  id VARCHAR(255) PRIMARY KEY,
  "userId" VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE, -- null يعني إشعار عام للكل
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  "createdAt" VARCHAR(100) NOT NULL,
  "isRead" BOOLEAN DEFAULT false,
  image TEXT,
  "productId" VARCHAR(255) REFERENCES products(id) ON DELETE SET NULL, -- ارتباط بالمنتج اختياري للتوجيه السلس
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ن. سجلات المطالبة بالهدايا المستهدفة (Targeted Gift Logs) - مرتبط بالعملاء والحملة
CREATE TABLE targeted_gift_logs (
  id VARCHAR(255) PRIMARY KEY,
  "userId" VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "userName" VARCHAR(255) NOT NULL,
  "userPhone" VARCHAR(255) NOT NULL,
  amount NUMERIC NOT NULL,
  "giftCampaignId" VARCHAR(255) NOT NULL REFERENCES targeted_gifts(id) ON DELETE CASCADE,
  "giftCampaignTitle" VARCHAR(255) NOT NULL,
  "createdAt" VARCHAR(100) NOT NULL,
  "expiryAt" VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- active, used, expired
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- 4. تحسين الأداء عبر بناء الفهارس (Indexes) للاستعلامات السريعة
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products("categoryId");
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders("userId");
CREATE INDEX IF NOT EXISTS idx_gifts_user ON gifts("userId");
CREATE INDEX IF NOT EXISTS idx_recharges_user ON recharges("userId");
CREATE INDEX IF NOT EXISTS idx_phone_req_user ON phone_requests("userId");
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications("userId");
CREATE INDEX IF NOT EXISTS idx_gift_logs_user ON targeted_gift_logs("userId");
CREATE INDEX IF NOT EXISTS idx_gift_logs_campaign ON targeted_gift_logs("giftCampaignId");


-- ==========================================
-- 5. تهيئة سياسات الأمان والتخويل العام عبر الـ API (Permissive Row-Level Security)
-- ==========================================
-- تفعيل سياسات الأمان على جميع الجداول، مع إنشاء سياسات مفتوحة للتطبيق والعملاء للتعديل والقراءة المباشرة 
-- بمفتاح ANON_KEY الخاص بـ Supabase ليماثل عمل Firestore بالكامل وبكل سلاسة.

-- أ. تهيئة أوتوماتيكية لتفعيل RLS وإضافة السياسات المفتوحة لجميع الجداول
DO $$
DECLARE
  tab RECORD;
BEGIN
  FOR tab IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
  LOOP
    -- تفعيل RLS على الجدول
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tab.table_name);
    
    -- حذف السياسات القديمة إن وجدت لتجنب التكرار
    EXECUTE format('DROP POLICY IF EXISTS "Permissive Select Policy" ON %I;', tab.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Permissive Insert Policy" ON %I;', tab.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Permissive Update Policy" ON %I;', tab.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Permissive Delete Policy" ON %I;', tab.table_name);
    
    -- إنشاء سياسات تتيح الوصول الكامل (قراءة، إضافة، تعديل، حذف) عبر الـ API العام بمفتاح Anon
    EXECUTE format('CREATE POLICY "Permissive Select Policy" ON %I FOR SELECT USING (true);', tab.table_name);
    EXECUTE format('CREATE POLICY "Permissive Insert Policy" ON %I FOR INSERT WITH CHECK (true);', tab.table_name);
    EXECUTE format('CREATE POLICY "Permissive Update Policy" ON %I FOR UPDATE USING (true) WITH CHECK (true);', tab.table_name);
    EXECUTE format('CREATE POLICY "Permissive Delete Policy" ON %I FOR DELETE USING (true);', tab.table_name);
    
    RAISE NOTICE 'تم تهيئة سياسات الأمان للجدول: %', tab.table_name;
  END LOOP;
END $$;


-- ==========================================
-- 6. تعليمات إنشاء حاوية التخزين لصور وملفات المتجر في Supabase (Storage Bucket)
-- ==========================================
-- في Supabase، يتم رفع وتخزين الصور في Buckets.
-- لتهيئة حاوية تخزين عامة لرفع صور المنتجات، الإيصالات، وسندات التحويل:
-- يمكنكِ الانتقال إلى لوحة التحكم في Supabase -> قسم Storage -> إنشاء حاوية جديدة (New Bucket) باسم: amrwh-storage
-- وجعلها عامة (Public Bucket).
-- أو تشغيل هذا السكريبت البرمجي لإنشائها برمجياً وتلقائياً:

INSERT INTO storage.buckets (id, name, public) 
VALUES ('amrwh-storage', 'amrwh-storage', true)
ON CONFLICT (id) DO NOTHING;

-- السماح بالوصول العام لرفع وتحميل وعرض الملفات من حاوية التخزين amrwh-storage
DROP POLICY IF EXISTS "Public Storage Access" ON storage.objects;
CREATE POLICY "Public Storage Access" ON storage.objects FOR ALL USING (bucket_id = 'amrwh-storage') WITH CHECK (bucket_id = 'amrwh-storage');
`;
