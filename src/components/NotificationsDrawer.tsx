import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bell, CheckCheck, Trash2, Calendar, Sparkles } from 'lucide-react';
import { formatArabicDate, getDirectImageUrl } from '../utils';
import { Database } from '../Database';

interface NotificationItem {
  id: string;
  userId?: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  image?: string;
  productId?: string;
}

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  userId: string;
  onRefresh: () => void;
  onNotificationClick?: (notif: NotificationItem) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  userId,
  onRefresh,
  onNotificationClick,
}) => {

  const handleMarkAllRead = () => {
    Database.markAllNotificationsRead(userId);
    onRefresh();
  };

  const handleClearNotifications = () => {
    Database.markAllNotificationsRead(userId);
    onRefresh();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex justify-end"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full max-w-md bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col text-right relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-amber-100/40 dark:border-gray-800 flex items-center justify-between bg-amber-500 text-white">
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-white/10 active:scale-95 transition text-white"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 justify-end">
                <div>
                  <h3 className="font-black text-sm text-white">صندوق الإشعارات 🌸</h3>
                  <p className="text-[9px] text-amber-100">تحديثات حسابكِ والعروض المخصصة</p>
                </div>
                <div className="bg-white/20 p-2 rounded-xl text-white">
                  <Bell className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Quick Actions Bar */}
            {notifications.length > 0 && (
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-850 border-b border-gray-100 dark:border-gray-850 flex justify-between items-center text-xs">
                <button
                  onClick={handleClearNotifications}
                  className="text-red-600 dark:text-red-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>تصفير المقروء</span>
                </button>

                <button
                  onClick={handleMarkAllRead}
                  className="text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>تعيين الكل كمقروء</span>
                </button>
              </div>
            )}

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-12">
                  <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-3xl text-amber-500 animate-bounce">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-gray-800 dark:text-gray-200">صندوق الإشعارات فارغ حالياً ✨</p>
                    <p className="text-[10px] text-gray-400 max-w-[240px] leading-relaxed">
                      عندما نرسل لكِ كود خصم، أو عند تحديث حالة طلبياتكِ وتغذية رصيدكِ، ستظهر التنبيهات هنا فوراً!
                    </p>
                  </div>
                </div>
              ) : (
                notifications.map((notif, idx) => (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => {
                      if (onNotificationClick) {
                        onNotificationClick(notif);
                      }
                    }}
                    className={`p-3.5 rounded-2xl border transition-all text-right ${
                      notif.productId ? 'cursor-pointer hover:border-amber-400 dark:hover:border-amber-700 hover:shadow-md' : ''
                    } ${
                      notif.isRead
                        ? 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 opacity-75'
                        : 'bg-amber-500/5 dark:bg-amber-500/5 border-amber-500/20 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 justify-end flex-row-reverse text-right">
                      {notif.image && (
                        <img
                          referrerPolicy="no-referrer"
                          src={getDirectImageUrl(notif.image)}
                          alt=""
                          className="w-12 h-12 rounded-xl object-cover border border-amber-500/10 shrink-0 shadow-sm"
                        />
                      )}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-gray-400 flex items-center gap-1 font-mono">
                            {formatArabicDate(notif.createdAt)}
                            <Calendar className="w-3 h-3 text-gray-400" />
                          </span>
                          
                          <div className="flex items-center gap-1.5">
                            {!notif.isRead && (
                              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                            )}
                            <h4 className={`text-xs font-black text-gray-900 dark:text-gray-100`}>
                              {notif.title}
                            </h4>
                          </div>
                        </div>

                        <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed font-semibold">
                          {notif.message}
                        </p>

                        {notif.productId && (
                          <div className="flex justify-end pt-1">
                            <span className="text-[9px] font-black text-amber-700 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/20 px-2.5 py-0.5 rounded-lg flex items-center gap-1 animate-pulse">
                              <span>انقري هنا لمشاهدة الصنف 🛍️</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-850 flex justify-center">
              <p className="text-[10px] text-gray-400 font-bold">متجر أم روح - خدمة عملاء متميزة على مدار الساعة 🌸</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
