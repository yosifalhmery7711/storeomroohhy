import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, ExternalLink, Globe, ShieldAlert } from 'lucide-react';
import { copyToClipboard } from '../utils';

interface UnauthorizedDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UnauthorizedDomainModal: React.FC<UnauthorizedDomainModalProps> = ({
  isOpen,
  onClose,
}) => {
  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedWildcard, setCopiedWildcard] = useState(false);

  const handleCopyDomain = async () => {
    const success = await copyToClipboard(currentDomain);
    if (success) {
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2000);
    }
  };

  const handleCopyWildcard = async () => {
    // Standard run.app wildcard configuration
    const success = await copyToClipboard('run.app');
    if (success) {
      setCopiedWildcard(true);
      setTimeout(() => setCopiedWildcard(false), 2000);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 15 }}
            className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-3xl p-6 space-y-5 shadow-2xl text-right relative border border-red-500/10 dark:border-red-900/30 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 p-1.5 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 justify-end border-b border-red-500/10 pb-3">
              <div className="text-right">
                <h3 className="text-sm font-black text-red-700 dark:text-red-400 flex items-center gap-2 justify-end">
                  <span>تنبيه: نطاق الويب غير معتمد في Firebase ⚠️</span>
                </h3>
                <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5">
                  يتطلب تسجيل الدخول بجوجل إضافة النطاق الحالي في لوحة تحكم Firebase الخاصة بكِ.
                </p>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 p-2.5 rounded-2xl text-red-600 dark:text-red-400 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
            </div>

            {/* Explanation */}
            <div className="space-y-3">
              <p className="text-[11.5px] text-gray-700 dark:text-gray-300 leading-relaxed font-semibold">
                لأسباب أمنية، يرفض نظام Firebase عمليات تسجيل الدخول (OAuth) من نطاقات ويب غير مسجلة في مشروعكِ. وبما أن بيئة المعاينة في AI Studio تولد روابط حيوية ومؤقتة، فيجب إعتماد النطاق الحالي يدوياً.
              </p>

              {/* Action Steps */}
              <div className="bg-gray-50 dark:bg-gray-850 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3">
                <h4 className="text-[11px] font-black text-amber-950 dark:text-amber-300">🛠️ خطوات تفعيل النطاق بسهولة:</h4>
                <ol className="text-[10.5px] text-gray-600 dark:text-gray-400 space-y-2 list-decimal pr-4">
                  <li>
                    افتحي <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-amber-600 dark:text-amber-400 hover:underline font-black inline-flex items-center gap-0.5">منصة Firebase <ExternalLink className="w-3 h-3" /></a> واختاري مشروعكِ.
                  </li>
                  <li>
                    من القائمة الجانبية، انتقلي إلى <strong>Authentication</strong> (المصادقة).
                  </li>
                  <li>
                    اختاري تبويب <strong>Settings</strong> (الإعدادات) في الأعلى.
                  </li>
                  <li>
                    انقري على قسم <strong>Authorized domains</strong> (النطاقات المعتمدة).
                  </li>
                  <li>
                    انقري على زر <strong>Add domain</strong> (إضافة نطاق) وقومي بإضافة النطاقات التالية:
                  </li>
                </ol>
              </div>

              {/* Domains to Copy */}
              <div className="space-y-2.5 pt-1">
                {/* Domain 1: Specific hostname */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 font-bold">
                    <button
                      onClick={handleCopyDomain}
                      className="flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      {copiedDomain ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500 text-[9px]">تم النسخ!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>نسخ النطاق</span>
                        </>
                      )}
                    </button>
                    <span>1. النطاق الحالي الخاص بهذه النسخة:</span>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 py-1.5 px-3 rounded-xl border dark:border-gray-700 text-left font-mono text-xs text-gray-700 dark:text-gray-300 overflow-x-auto select-all">
                    <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="flex-1 select-all">{currentDomain}</span>
                  </div>
                </div>

                {/* Domain 2: Wildcard */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 font-bold">
                    <button
                      onClick={handleCopyWildcard}
                      className="flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      {copiedWildcard ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500 text-[9px]">تم النسخ!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>نسخ النطاق العام</span>
                        </>
                      )}
                    </button>
                    <span>2. النطاق العام لجميع روابط Cloud Run (موصى به لتفادي التكرار):</span>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 py-1.5 px-3 rounded-xl border dark:border-gray-700 text-left font-mono text-xs text-gray-700 dark:text-gray-300 select-all">
                    <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="flex-1 select-all">run.app</span>
                  </div>
                </div>
              </div>

              {/* Notice */}
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-extrabold text-center bg-amber-500/5 p-2.5 rounded-xl border border-amber-500/10 leading-relaxed mt-2">
                💡 نصيحة: بمجرد إضافة النطاق وحفظ التغييرات في Firebase، يمكنكِ إغلاق هذه النافذة ومحاولة تسجيل الدخول مباشرة دون الحاجة لإعادة تشغيل أو بناء التطبيق! 🌸✨
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-gray-900 hover:bg-gray-850 dark:bg-gray-850 dark:hover:bg-gray-800 text-white dark:text-gray-200 text-xs font-black rounded-xl shadow-md transition cursor-pointer"
              >
                فهمت، سأقوم بضبطها الآن 👍
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
