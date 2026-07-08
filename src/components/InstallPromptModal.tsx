import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, Download, Share2, PlusSquare, ArrowUp, X, Sparkles, AlertCircle, ExternalLink } from 'lucide-react';
import { Database } from '../Database';

interface InstallPromptModalProps {
  deferredPrompt: any;
  onInstallSuccess: () => void;
}

export default function InstallPromptModal({ deferredPrompt, onInstallSuccess }: InstallPromptModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIframe, setIsIframe] = useState(false);
  const [hasSW, setHasSW] = useState(false);
  const [swActive, setSwActive] = useState(false);
  const [isSecure, setIsSecure] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  
  // Track deferredPrompt locally so we can capture it from both prop and window global events
  const [localDeferredPrompt, setLocalDeferredPrompt] = useState<any>(() => {
    return deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPrompt : null);
  });

  const [showManualStepsFallback, setShowManualStepsFallback] = useState(false);

  useEffect(() => {
    if (deferredPrompt) {
      setLocalDeferredPrompt(deferredPrompt);
    }
  }, [deferredPrompt]);

  useEffect(() => {
    setIsIframe(typeof window !== 'undefined' && window.self !== window.top);
    setIsSecure(typeof window !== 'undefined' && window.isSecureContext);
    setHasSW(typeof window !== 'undefined' && 'serviceWorker' in navigator);
    
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        setSwActive(!!reg);
      }).catch(() => {
        setSwActive(false);
      });
    }

    // 1. Check if already installed / in standalone mode
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    
    setIsStandalone(isStandaloneMode);

    // 2. Check if the device is iOS (iPhone/iPad)
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isIOSDevice);

    // 3. Listen for global PWA events in case it fires before component is active
    if (typeof window !== 'undefined' && (window as any).deferredPrompt) {
      setLocalDeferredPrompt((window as any).deferredPrompt);
    }

    const handleGlobalPrompt = (e: any) => {
      if (e.detail) {
        console.log("⚡ InstallPromptModal: captured global-beforeinstallprompt event");
        setLocalDeferredPrompt(e.detail);
      }
    };
    const handleNativePrompt = (e: any) => {
      e.preventDefault();
      console.log("⚡ InstallPromptModal: captured native beforeinstallprompt event");
      setLocalDeferredPrompt(e);
      if (typeof window !== 'undefined') {
        (window as any).deferredPrompt = e;
      }
    };
    window.addEventListener('global-beforeinstallprompt', handleGlobalPrompt);
    window.addEventListener('beforeinstallprompt', handleNativePrompt);

    // 4. Listen for custom manual trigger events from download buttons
    const handleManualTrigger = () => {
      setIsOpen(true);
    };
    window.addEventListener('trigger-install-prompt-modal', handleManualTrigger);

    // 5. Decide to show prompt if not in standalone and hasn't been dismissed in the current session
    const isDismissed = sessionStorage.getItem('amrwh_install_prompt_dismissed') === 'true';

    let timer: NodeJS.Timeout;
    if (!isStandaloneMode && !isDismissed) {
      // Show prompt after a 1-minute delay of browsing as requested
      timer = setTimeout(() => {
        setIsOpen(true);
      }, 60000);
    }

    return () => {
      window.removeEventListener('global-beforeinstallprompt', handleGlobalPrompt);
      window.removeEventListener('beforeinstallprompt', handleNativePrompt);
      window.removeEventListener('trigger-install-prompt-modal', handleManualTrigger);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptToUse = localDeferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPrompt : null);
    
    const logs: string[] = [];
    const logMessage = (msg: string) => {
      console.log(`[PWA Debug] ${msg}`);
      logs.push(msg);
    };

    logMessage("تم الضغط على زر التثبيت.");
    logMessage(`حالة الإطار (Iframe): ${isIframe ? "داخل إطار (ممنوع من التثبيت)" : "مستقل (مسموح)"}`);
    logMessage(`حالة بروتوكول الأمان (HTTPS): ${isSecure ? "آمن HTTPS" : "غير آمن HTTP (ممنوع)"}`);
    logMessage(`وجود Service Worker: ${hasSW ? "نعم متوفر" : "لا، غير مدعوم"}`);
    logMessage(`تفعيل الـ Service Worker: ${swActive ? "مفعل ومسجل" : "قيد التسجيل أو معطل"}`);
    logMessage(`حدث التثبيت (deferredPrompt): ${promptToUse ? "موجود وجاهز ⚡" : "غير موجود (محظور من المتصفح) ❌"}`);

    setDiagnosticLogs(logs);

    if (promptToUse) {
      try {
        logMessage('جاري استدعاء نافذة التثبيت الرسمية للمتصفح...');
        // Show the installation prompt
        await promptToUse.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await promptToUse.userChoice;
        logMessage(`استجابة المستخدم لطلب التثبيت: ${outcome}`);
        
        if (outcome === 'accepted') {
          logMessage('تم قبول التثبيت بنجاح!');
          onInstallSuccess();
          if (typeof window !== 'undefined') {
            (window as any).deferredPrompt = null;
          }
          setLocalDeferredPrompt(null);
          setIsOpen(false);
        } else {
          logMessage('تم إلغاء التثبيت من قبل المستخدم.');
        }
      } catch (err: any) {
        logMessage(`فشل تشغيل نافذة التثبيت الرسمية: ${err?.message || err}`);
        console.error('Failed to trigger native install prompt:', err);
        setShowManualStepsFallback(true);
      }
    } else {
      logMessage('لم يتم العثور على حدث التثبيت. سيتم تفعيل شاشة التثبيت اليدوي لمساعدة المستخدم.');
      setShowManualStepsFallback(true);
      
      // Also provide a descriptive console warning with precise directions
      console.warn(
        "⚠️ [PWA Installation Blocked] Chrome is preventing automatic installation because:\n" +
        `- Is Inside Iframe: ${isIframe} (Chrome blocks iframe PWA install)\n` +
        `- Is Secure Context (HTTPS): ${isSecure}\n` +
        `- Service Worker Registered: ${swActive}\n` +
        "Please open the site directly in a new browser tab and wait a few seconds."
      );
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('amrwh_install_prompt_dismissed', 'true');
    setIsOpen(false);
  };

  // If already standalone, do not render anything
  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md" dir="rtl">
          {/* Main Modal Container */}
          <motion.div
            initial={{ opacity: 0, y: 150 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 150 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full max-w-md bg-gradient-to-b from-white to-amber-50/20 dark:from-gray-900 dark:to-gray-950 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border border-amber-500/10 dark:border-amber-500/5 relative overflow-hidden"
          >
            {/* Top decorative line for mobile pull down */}
            <div className="w-12 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4 sm:hidden" />

            {/* Glowing Accent Ring Background */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 left-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-full transition-all cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-6 text-center">
              {/* App Icon Branding */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-20 h-20 bg-gradient-to-tr from-amber-400 to-amber-500 rounded-3xl flex items-center justify-center shadow-lg shadow-amber-500/20 text-4xl animate-pulse">
                    🌸
                  </div>
                  <span className="absolute -bottom-1 -right-1 bg-amber-800 text-white p-1.5 rounded-full border border-white dark:border-gray-900 shadow-md">
                    <Smartphone className="w-3.5 h-3.5" />
                  </span>
                </div>
                <h3 className="text-base font-black text-amber-950 dark:text-amber-200 mt-4 flex items-center gap-1.5">
                  <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500/20" />
                  <span>تثبيت تطبيق متجر أم روح 🌸</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mt-1.5 leading-relaxed">
                  احصلي على متجر أم روح على شاشتكِ الرئيسية لتسوق سريع وآمن بنقرة واحدة بدون متصفح! ✨
                </p>
              </div>

              {/* Core Features list */}
              <div className="bg-amber-50/40 dark:bg-amber-950/20 rounded-2xl p-3.5 border border-amber-500/5 grid grid-cols-3 gap-2 text-right">
                <div className="text-center p-1 space-y-1">
                  <span className="text-lg block">⚡</span>
                  <h5 className="text-[10px] font-black text-amber-950 dark:text-amber-300">أسرع بـ 3 أضعاف</h5>
                  <p className="text-[8px] text-gray-400 leading-snug">تصفح فوري وسلس</p>
                </div>
                <div className="text-center p-1 space-y-1 border-x border-amber-100/30 dark:border-gray-800">
                  <span className="text-lg block">📉</span>
                  <h5 className="text-[10px] font-black text-amber-950 dark:text-amber-300">موفر للبيانات</h5>
                  <p className="text-[8px] text-gray-400 leading-snug">استهلاك أقل للإنترنت</p>
                </div>
                <div className="text-center p-1 space-y-1">
                  <span className="text-lg block">📴</span>
                  <h5 className="text-[10px] font-black text-amber-950 dark:text-amber-300">يعمل بدون إنترنت</h5>
                  <p className="text-[8px] text-gray-400 leading-snug">مزامنة كاش المنتجات</p>
                </div>
              </div>

              {/* Actions Section */}
              <div className="space-y-3">
                {isIOS ? (
                  /* Custom step-by-step instruction panel for iOS / Apple Safari */
                  <div className="bg-white dark:bg-gray-900 border border-amber-100 dark:border-gray-800 rounded-2xl p-4 text-right space-y-3 shadow-inner">
                    <h4 className="text-xs font-black text-amber-950 dark:text-amber-300 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      <span>خطوات التثبيت السريعة للآيفون (iOS):</span>
                    </h4>
                    
                    <ol className="space-y-2.5 text-xs text-gray-600 dark:text-gray-400">
                      <li className="flex items-center gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-400 font-extrabold text-[10px] flex items-center justify-center">
                          1
                        </span>
                        <span className="flex items-center gap-1.5 flex-wrap">
                          اضغطي على زر 
                          <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-lg font-bold text-[10px]">
                            <Share2 className="w-3.5 h-3.5 text-blue-500" /> مشاركة (Share)
                          </span>
                          في شريط سفلي للمتصفح.
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-400 font-extrabold text-[10px] flex items-center justify-center">
                          2
                        </span>
                        <span className="flex items-center gap-1.5 flex-wrap">
                          مرري للأسفل واختاري 
                          <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-lg font-bold text-[10px]">
                            <PlusSquare className="w-3.5 h-3.5 text-gray-500" /> إضافة إلى الشاشة الرئيسية
                          </span>
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-400 font-extrabold text-[10px] flex items-center justify-center">
                          3
                        </span>
                        <span>
                          اضغطي على <strong>إضافة (Add)</strong> بالأعلى لتثبيت التطبيق بنجاح! 🎉
                        </span>
                      </li>
                    </ol>

                    <div className="pt-2 text-center flex flex-col items-center justify-center text-[10px] text-gray-400 animate-bounce">
                      <span>اضغطي بالأسفل على زر المشاركة ثم "إضافة للشاشة الرئيسية" 🔽</span>
                    </div>
                  </div>
                ) : (
                  /* Standard Android / Chrome / PC / Mac layout with a direct, single install button */
                  <div className="space-y-4 text-right">
                    {/* Direct Install Button */}
                    <button
                      onClick={handleInstallClick}
                      className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-sm py-4 px-6 rounded-2xl shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer animate-pulse"
                    >
                      <Download className="w-5 h-5" />
                      <span>تثبيت التطبيق الآن كتطبيق حقيقي ⚡</span>
                    </button>

                    {/* Direct Android APK Download Button */}
                    <button
                      onClick={() => {
                        const adminSettingsObj = Database.getAdminSettings();
                        const downloadUrl = adminSettingsObj.androidDownloadUrl || 'https://archive.org/download/ruh-store/RuhStore.apk';
                        const link = document.createElement('a');
                        link.href = downloadUrl;
                        link.download = 'RuhStore.apk';
                        link.target = '_blank';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black text-xs py-3.5 px-6 rounded-2xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Smartphone className="w-4.5 h-4.5" />
                      <span>تنزيل تطبيق الأندرويد المباشر (APK) 🤖</span>
                    </button>

                    {/* Helpful tips and warnings shown elegantly beneath the button (never blocking it) */}
                    {isIframe && (
                      <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-xs text-amber-950 dark:text-amber-200">
                        <p className="font-bold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          <span>تنبيه بخصوص إطار المعاينة:</span>
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                          المتصفحات تمنع التثبيت التلقائي من داخل لوحة المعاينة (iframe). يُفضل فتح الرابط المباشر للمتجر في نافذة خارجية مستقلة لتثبيته بنقرة واحدة.
                        </p>
                      </div>
                    )}

                    {showManualStepsFallback && (
                      <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-gray-800 rounded-xl p-3 text-xs text-gray-700 dark:text-gray-300">
                        <p className="font-bold flex items-center gap-1 text-amber-800 dark:text-amber-400">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          <span>توجيه للتثبيت اليدوي:</span>
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed">
                          إذا لم يستجب متصفحكِ للتثبيت التلقائي المباشر، يمكنكِ النقر على زر خيارات المتصفح الخاص بكِ (⋮) بالأعلى أو الأسفل، ثم اختيار <strong>تثبيت التطبيق (Install App)</strong> أو <strong>إضافة إلى الشاشة الرئيسية</strong> لتنزيله فوراً كتطبيق مستقل حقيقي بجميع المزايا! 🌸
                        </p>
                      </div>
                    )}

                    {!localDeferredPrompt && !showManualStepsFallback && (
                      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-3 text-xs text-gray-600 dark:text-gray-400">
                        <p className="font-bold flex items-center gap-1 text-amber-800 dark:text-amber-400">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          <span>إذا لم يبدأ التثبيت تلقائياً عند النقر:</span>
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed">
                          يمكنكِ النقر على خيارات المتصفح الخاص بكِ (⋮) ثم اختيار <strong>تثبيت التطبيق (Install App)</strong> أو <strong>إضافة إلى الشاشة الرئيسية</strong> يدوياً لتنزيله فوراً كتطبيق مستقل. 🌸
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Continue in Browser Button */}
                <button
                  onClick={handleDismiss}
                  className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 font-bold text-xs py-3 px-6 rounded-xl transition duration-200 cursor-pointer"
                >
                  المتابعة من خلال المتصفح 🌐
                </button>

                {/* Diagnostics Toggle */}
                <div className="pt-2">
                  <button
                    onClick={() => setShowDiagnostics(!showDiagnostics)}
                    className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-amber-600 transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer"
                  >
                    <span>{showDiagnostics ? "إخفاء تشخيصات الـ PWA الفنية 🛠️" : "عرض تشخيصات الـ PWA الفنية 🛠️"}</span>
                  </button>
                  {showDiagnostics && (
                    <div className="mt-2 text-right bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-3 text-[11px] font-mono space-y-1.5 text-gray-600 dark:text-gray-400">
                      <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-1">
                        <span className="font-sans font-bold text-gray-700 dark:text-gray-300">الخاصية الفنية</span>
                        <span className="font-sans font-bold text-gray-700 dark:text-gray-300">الحالة</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-500">HTTPS / بيئة آمنة</span>
                        <span className={isSecure ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                          {isSecure ? "نشط ✓" : "غير مدعوم ✗"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-500">Service Worker مدعوم</span>
                        <span className={hasSW ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                          {hasSW ? "مدعوم ✓" : "غير مدعوم ✗"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-500">Service Worker مسجّل</span>
                        <span className={swActive ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                          {swActive ? "مسجّل ✓" : "غير مسجّل ✗"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-500">معاينة داخل إطار (Iframe)</span>
                        <span className={isIframe ? "text-amber-500 font-bold" : "text-green-500 font-bold"}>
                          {isIframe ? "نعم (معطل) ✗" : "لا (مباشر) ✓"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-500">حدث التثبيت الجاهز</span>
                        <span className={localDeferredPrompt ? "text-green-500 font-bold" : "text-amber-500 font-bold"}>
                          {localDeferredPrompt ? "جاهز ✓" : "غير جاهز يدوياً فقط"}
                        </span>
                      </div>
                      {diagnosticLogs.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                          <p className="font-sans font-bold text-gray-700 dark:text-gray-300 mb-1">سجل التفاعل الأخير:</p>
                          <ul className="list-disc list-inside space-y-1 text-[10px] text-gray-500 dark:text-gray-400">
                            {diagnosticLogs.map((log, idx) => (
                              <li key={idx} className="leading-relaxed">{log}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
