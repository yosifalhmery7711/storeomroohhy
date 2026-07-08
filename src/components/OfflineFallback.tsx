import React from 'react';
import { WifiOff, RotateCw, Phone, MessageSquare, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

interface OfflineFallbackProps {
  onRetry: () => void;
  isSyncing: boolean;
  storeWhatsapp?: string;
}

export default function OfflineFallback({ onRetry, isSyncing, storeWhatsapp = '967739563915' }: OfflineFallbackProps) {
  const whatsappUrl = `https://wa.me/${storeWhatsapp}?text=${encodeURIComponent('مرحباً أم روح، أواجه مشكلة في الاتصال بالإنترنت أثناء فتح تطبيق المتجر.')}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100/50 dark:from-gray-950 dark:to-gray-900 flex flex-col items-center justify-center p-6 text-right" dir="rtl">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-amber-100 dark:border-gray-800 p-8 space-y-6 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-200/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header/Icon */}
        <div className="flex flex-col items-center text-center space-y-4">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
            className="w-20 h-20 bg-amber-50 dark:bg-amber-950/30 rounded-full flex items-center justify-center border border-amber-100 dark:border-amber-900/50 shadow-inner relative"
          >
            <WifiOff className="w-10 h-10 text-amber-600 dark:text-amber-400 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500"></span>
            </span>
          </motion.div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-amber-950 dark:text-amber-200 tracking-tight">
              متجر أم روح يرحب بكِ! 🌸✨
            </h1>
            <p className="text-xs font-semibold text-amber-700/80 dark:text-amber-400/80 uppercase tracking-widest font-mono">
              تصفح آمن • خدمة متميزة
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-amber-100 dark:via-gray-800 to-transparent" />

        {/* Explanatory Message */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            تنبيه الاتصال الأول بالإنترنت
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
            يبدو أنكِ لستِ متصلة بالإنترنت حالياً لبدء التنشيط الأول للمتجر واستيراد أحدث المنتجات، العروض، والأسعار من السحابة. 
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed">
            يرجى التأكد من تفعيل الواي فاي أو شبكة الجيل الرابع في هاتفكِ، ثم الضغط على زر "إعادة الاتصال" بالأسفل لنقوم بتحميل المتجر لكِ وتخزين النسخة الاحتياطية لتصفحها لاحقاً حتى بدون إنترنت!
          </p>
        </div>

        {/* Buttons / Actions */}
        <div className="space-y-3 pt-2">
          <button
            onClick={onRetry}
            disabled={isSyncing}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'جاري التحقق والمحاولة...' : 'إعادة الاتصال والمحاولة'}
          </button>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold py-3 px-4 rounded-2xl border border-gray-100 dark:border-gray-700 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 text-xs"
          >
            <MessageSquare className="w-4 h-4 text-emerald-500" />
            التواصل الفوري مع الدعم عبر واتساب
          </a>
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-gray-50 dark:border-gray-800/50 flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500 font-semibold font-mono">
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3 text-amber-500" />
            +{storeWhatsapp}
          </span>
          <span>RUH STORE v2.1 (STANDALONE)</span>
        </div>
      </div>
    </div>
  );
}
